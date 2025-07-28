import type { APIMethodParams, TelegramInputMedia } from "gramio";

type Text = string | { toString(): string };

export class ResponseView {
	private readonly response = {
		text: undefined as Text | undefined,
		keyboard: undefined as
			| APIMethodParams<"sendMessage">["reply_markup"]
			| undefined,
		media: undefined as TelegramInputMedia | undefined,
	};

	text(text: Text) {
		this.response.text = text;

		return this;
	}

	keyboard(keyboard: APIMethodParams<"sendMessage">["reply_markup"]) {
		this.response.keyboard = keyboard;

		return this;
	}

	media(media: TelegramInputMedia) {
		this.response.media = media;

		return this;
	}
}
