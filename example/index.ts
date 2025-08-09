import { initViewsBuilder } from "@gramio/views";
import { Bot, InlineKeyboard, MediaInput, MediaUpload } from "gramio";

const defineView = initViewsBuilder();

const onlyMessageView = defineView().render(function () {
	return this.response
		.text(`Only message. Current timestamp: ${new Date().toISOString()}`)
		.keyboard(
			new InlineKeyboard()
				.columns(1)
				.text("Message with text only ›", "TEXT")
				.text("Message with single media ›", "MEDIA")
				.text("Message with media group ›", "MEDIA_GROUP"),
		);
});

const singleMediaView = defineView().render(async function () {
	return this.response
		.text("Message with single media.")
		.keyboard(
			new InlineKeyboard()
				.columns(1)
				.text("Message with text only ›", "TEXT")
				.text("Message with single media ›", "MEDIA")
				.text("Message with media group ›", "MEDIA_GROUP"),
		)
		.media(
			MediaInput.photo(await MediaUpload.url("https://picsum.photos/500")),
		);
});

const mediaGroupView = defineView().render(async function () {
	return this.response
		.text("Message with media group. Buttons is not allowed.")
		.media([
			MediaInput.photo(await MediaUpload.url("https://picsum.photos/500")),
			MediaInput.photo("https://picsum.photos/500"),
			MediaInput.photo(await MediaUpload.url("https://picsum.photos/500")),
		]);
});

const bot = new Bot(process.env.BOT_TOKEN!)
	.derive(["message", "callback_query"], (context) => ({
		render: defineView.buildRender(context, {}),
	}))
	.command("text", async (context) => {
		return context.render(onlyMessageView);
	})
	.command("media", async (context) => {
		return context.render(singleMediaView);
	})
	.command("media_group", async (context) => {
		return context.render(mediaGroupView);
	})
	.callbackQuery("TEXT", async (context) => {
		return context.render(onlyMessageView);
	})
	.callbackQuery("MEDIA", async (context) => {
		return context.render(singleMediaView);
	})
	.callbackQuery("MEDIA_GROUP", async (context) => {
		return context.render(mediaGroupView);
	})
	.onStart(console.log);

bot.start();
