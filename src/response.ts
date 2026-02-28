import type { TelegramInputMedia, TelegramParams } from "gramio";

type Text = string | { toString(): string };
type Keyboard = TelegramParams.SendMessageParams["reply_markup"];

/** Media types that cannot be edited in-place via Telegram API — require delete+resend on edit */
export type NonEditableMedia =
	| { type: "sticker"; media: Blob | string }
	| { type: "voice"; media: Blob | string }
	| { type: "video_note"; media: Blob | string };

export type Media = TelegramInputMedia | NonEditableMedia;
type MediaGroup = TelegramParams.SendMediaGroupParams["media"];

export class ResponseView {
	private readonly response = {
		text: undefined as Text | undefined,
		keyboard: undefined as Keyboard | undefined,
		media: undefined as Media | MediaGroup | undefined,
	};

	text(text: Text) {
		this.response.text = text;

		return this;
	}

	keyboard(keyboard: Keyboard) {
		this.response.keyboard = keyboard;

		return this;
	}

	media(media: Media | MediaGroup) {
		this.response.media = media;

		return this;
	}
}
