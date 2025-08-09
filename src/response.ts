import type { TelegramInputMedia, TelegramParams } from "gramio";

type Text = string | { toString(): string };
type Keyboard = TelegramParams.SendMessageParams["reply_markup"];
type Media = TelegramInputMedia;
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
