import ora from "ora";
import path from "path";
import { DATA_DIR, NO_SLACK_CONNECT, OUT_DIR } from "./config.js";
import { downloadURL } from "./download-files.js";
import { Team } from "./interfaces.js";
import { getWebClient } from "./web-client.js";

export async function downloadTeamData(): Promise<Team> {
  if (NO_SLACK_CONNECT) {
    return {};
  }

  const response = await getWebClient().team.info();
  if (response.ok) {
    return response.team!;
  } else {
    return {};
  }
}

export function getTeamIconPath(
  team: Team,
  small: boolean,
): { absoultePath: string; relativePath: string; url: string } {
  const url = small ? team.icon?.image_44! : team.icon?.image_230!;
  const extension = path.extname(url);
  const filePath = path.join(
    OUT_DIR,
    `team${small ? "_small" : ""}${extension}`,
  );

  return {
    url,
    absoultePath: filePath,
    relativePath: path.relative(OUT_DIR, filePath),
  };
}

export async function downloadTeamIcons(team: Team): Promise<void> {
  const spinner = ora(`Downloading team icons`).start();

  const icon = getTeamIconPath(team, false);
  const smallIcon = getTeamIconPath(team, true);

  await downloadURL(icon.url, icon.absoultePath);
  await downloadURL(smallIcon.url, smallIcon.absoultePath);
  spinner.succeed(`Downloaded team icons`);
}
