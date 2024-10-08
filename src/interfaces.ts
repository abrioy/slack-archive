import { FieldMessage as SlackMessage } from "@slack/web-api/dist/types/response/ConversationsHistoryResponse";
import { Channel as SlackChannel } from "@slack/web-api/dist/types/response/ConversationsListResponse";
import { User as SlackUser } from "@slack/web-api/dist/types/response/UsersInfoResponse";
import { File as SlackFile } from "@slack/web-api/dist/types/response/FilesInfoResponse";
import { Team as SlackTeam } from "@slack/web-api/dist/types/response/TeamInfoResponse";
import { Reaction as SlackReaction } from "@slack/web-api/dist/types/response/ReactionsGetResponse";
import { AuthTestResponse } from "@slack/web-api";

export type User = SlackUser;

export type Users = Record<string, User>;

export type Team = SlackTeam;

export type Emojis = Record<string, Emoji>;

export type Emoji =
  | {
      custom: true;
      name: string;
      path: string;
    }
  | {
      custom: false;
      name: string;
      path: string;
      unicode: string;
    };

export interface ArchiveMessage extends SlackMessage {
  replies?: Array<SlackMessage>;
}

export type Reaction = SlackReaction;

export type Message = SlackMessage;

export type Channel = SlackChannel;

export type File = SlackFile;

export type SearchPageIndex = Record<string, Array<string>>;

export type SearchFile = {
  users: Record<string, string>; // userId -> userName
  channels: Record<string, string>; // channelId -> channelName
  messages: Record<string, Array<SearchMessage>>;
  pages: SearchPageIndex;
};

export type SearchMessage = {
  m?: string; // Message
  u?: string; // User
  t?: string; // Timestamp
  c?: string; // Channel
};

export interface SlackArchiveChannelData {
  messages: number;
  fullyDownloaded: boolean;
}

export interface SlackArchiveData {
  channels: Record<string, SlackArchiveChannelData>;
  auth?: AuthTestResponse;
}

export interface ChunkInfo {
  oldest?: string;
  newest?: string;
  count: number;
}

export type ChunksInfo = Array<ChunkInfo>;
