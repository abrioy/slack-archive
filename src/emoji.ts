import fs from "fs";
import ora from "ora";
import path from "path";

import {
  Accessory,
  AccessoryElement,
  PurpleElement,
  TitleBlockElement,
} from "@slack/web-api/dist/types/response/ConversationsHistoryResponse.js";
import emojiData from "emoji-datasource-google" assert { type: "json" };
import {
  __dirname,
  BASIC_EMOJIS_DIR,
  DATA_DIR,
  EMOJIS_DIR,
  NO_SLACK_CONNECT,
} from "./config.js";
import { getEmoji } from "./data-load.js";
import { downloadURL } from "./download-files.js";
import { ArchiveMessage, Emojis } from "./interfaces.js";
import { getWebClient } from "./web-client.js";

const BASIC_EMOJI_LIST: {
  short_name: string;
  short_names: string[];
  image: string;
  unified: string;
}[] = emojiData;

function getEmojiFilePath(
  name: string,
  extension: string | null,
  relative: boolean,
): string | null {
  // If we have an extension, return the correct path
  if (extension) {
    return path.join(EMOJIS_DIR, `${name}${extension}`);
  }

  // If we don't have an extension, return the first path that exists
  // regardless of extension
  const extensions = [".png", ".jpg", ".gif"];
  for (const ext of extensions) {
    if (fs.existsSync(path.join(EMOJIS_DIR, `${name}${ext}`))) {
      const result = path.join(EMOJIS_DIR, `${name}${ext}`);
      if (relative) {
        return path.relative(DATA_DIR, result);
      } else {
        return result;
      }
    }
  }
  return null;
}

export async function downloadEmojiList(): Promise<Record<string, string>> {
  if (NO_SLACK_CONNECT) {
    return {};
  }

  const response = await getWebClient().emoji.list();
  if (response.ok) {
    return response.emoji!;
  } else {
    return {};
  }
}

async function downloadEmoji(
  name: string,
  url: string,
): Promise<string | null> {
  const extension = path.extname(url);
  const filePath = getEmojiFilePath(name, extension, false);

  if (filePath) {
    await downloadURL(url, filePath!);
  }
  return filePath;
}

function getEmojiFinalName(
  name: string,
  emojiList: Record<string, string>,
): string | null {
  const url = emojiList[name];
  if (url) {
    const alias = getEmojiAlias(url);
    if (alias) {
      return getEmojiFinalName(alias, emojiList);
    } else {
      return name;
    }
  }
  return null;
}

function getEmojiAlias(url: string): string | null {
  if (url.startsWith("alias:")) {
    // Ugh regex methods - this should turn "alias:hi-bob" into "hi-bob"
    const alias = [...url.matchAll(/alias:(.*)/g)][0][1]!;
    return alias!;
  } else {
    return null;
  }
}

async function copyBasicEmoji(imageName: string) {
  const sourcePath = path.join(
    __dirname,
    "..",
    "node_modules/emoji-datasource-google/img/google/64",
    imageName,
  );
  const destinationPath = path.join(BASIC_EMOJIS_DIR, imageName);
  fs.cpSync(sourcePath, destinationPath);
}

function findEmojisInMessageBlocks(
  blocks: (TitleBlockElement | Accessory | AccessoryElement | PurpleElement)[],
  emojiSet: Set<string>,
) {
  for (const block of blocks) {
    if (block.type === "emoji") {
      const emojiName = (block as PurpleElement).name;
      if (emojiName) {
        emojiSet.add(emojiName);
      }
    } else if ("elements" in block && block.elements) {
      findEmojisInMessageBlocks(block.elements, emojiSet);
    }
  }
}

export async function findEmojis(messages: Array<ArchiveMessage>) {
  const spinner = ora(
    `Scanning 0/${messages.length} messages for emoji shortcodes...`,
  ).start();
  const emojisToDownload = new Set<string>();

  for (const [i, message] of messages.entries()) {
    spinner.text = `Scanning ${i}/${messages.length} messages for emoji shortcodes...`;

    // Reactions
    if (message.reactions && message.reactions.length > 0) {
      for (const reaction of message.reactions) {
        emojisToDownload.add(reaction.name);
      }
    }

    // Text
    findEmojisInMessageBlocks(message.blocks || [], emojisToDownload);
  }

  spinner.succeed(`Scanned ${messages.length} messages for emoji`);

  return [...emojisToDownload];
}

export async function downloadEmojis(
  emojisToDownload: Array<string>,
  emojiList: Record<string, string>,
): Promise<void> {
  const spinner = ora(
    `Fetching 0/${emojisToDownload.length} emojis...`,
  ).start();

  fs.mkdirSync(BASIC_EMOJIS_DIR, { recursive: true });

  let downloaded = 0;
  let copied = 0;
  for (const [i, name] of emojisToDownload.entries()) {
    spinner.text = `Downloading ${i}/${emojisToDownload.length} emoji...`;

    if (emojiList[name]) {
      const finalName = getEmojiFinalName(name, emojiList);
      const path =
        finalName && (await downloadEmoji(finalName, emojiList[finalName]));
      if (path) {
        downloaded++;
      } else {
        console.warn(`Unable to download the emoji :${name}:`);
      }
    } else {
      const baseName = name.match(/::/) && name.split("::")[0];
      const basicEmoji = BASIC_EMOJI_LIST.find(
        (emoji) =>
          emoji.short_names.includes(name) ||
          (baseName && emoji.short_names.includes(baseName)),
      );
      if (basicEmoji) {
        copied++;
        copyBasicEmoji(basicEmoji.image);
      } else {
        console.warn(
          `Unable to find the emoji :${name}: neither in custom nor basic emoji`,
        );
      }
    }
  }

  const actual = downloaded + copied;
  const total = emojisToDownload.length;
  const message = `Downloaded ${downloaded} custom emoji and copied ${copied} basic emoji (${actual}/${total})`;
  if (actual < total) {
    spinner.warn(message);
  } else {
    spinner.succeed(message);
  }
}

export async function getEmojis(): Promise<Emojis> {
  const customEmojiList = await getEmoji();

  const spinner = ora(
    `Indexing ${BASIC_EMOJI_LIST.length} basic emoji...`,
  ).start();

  const basicEmojis: Emojis = BASIC_EMOJI_LIST.reduce((acc, emoji) => {
    for (const short_name of emoji.short_names) {
      acc[short_name] = {
        custom: false,
        name: short_name,
        unicode: emoji.unified,
        path: path.relative(DATA_DIR, path.join(BASIC_EMOJIS_DIR, emoji.image)),
      };
    }
    return acc;
  }, {} as Emojis);

  const emojiNames = Object.keys(customEmojiList);
  const customEmojis: Emojis = {};
  for (const [i, name] of emojiNames.entries()) {
    spinner.text = `Finding ${i}/${emojiNames.length} emoji...`;

    const finalName = getEmojiFinalName(name, customEmojiList);
    const path = finalName && getEmojiFilePath(finalName, null, true);
    if (path) {
      customEmojis[name] = {
        custom: true,
        name,
        path,
      };
    }
  }

  spinner.succeed(
    `Found ${BASIC_EMOJI_LIST.length} basic emoji and ${Object.keys(customEmojis).length} custom emoji`,
  );

  return {
    ...basicEmojis,
    ...customEmojis,
  };
}
