require('dotenv').config();

const fs = require('node:fs/promises');
const path = require('node:path');
const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!telegramToken || !openaiApiKey) {
  console.error('Missing TELEGRAM_BOT_TOKEN or OPENAI_API_KEY in environment variables.');
  process.exit(1);
}

const outputsDir = path.join(__dirname, 'outputs');
const bot = new TelegramBot(telegramToken, { polling: true });
const openai = new OpenAI({ apiKey: openaiApiKey });

async function ensureOutputsDir() {
  await fs.mkdir(outputsDir, { recursive: true });
}

async function generateImage(prompt) {
  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1024x1024'
  });

  const imageBase64 = response.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new Error('OpenAI did not return image data.');
  }

  const fileName = `image-${Date.now()}.png`;
  const filePath = path.join(outputsDir, fileName);
  const buffer = Buffer.from(imageBase64, 'base64');

  await fs.writeFile(filePath, buffer);
  return filePath;
}

bot.onText(/^\/image(?:\s+([\s\S]+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const prompt = (match?.[1] || '').trim();

  if (!prompt) {
    await bot.sendMessage(chatId, 'Usage: /image <prompt>');
    return;
  }

  try {
    await ensureOutputsDir();
    await bot.sendMessage(chatId, 'Generating image...');

    const imagePath = await generateImage(prompt);
    await bot.sendPhoto(chatId, imagePath, {
      caption: `Prompt: ${prompt}`
    });
  } catch (error) {
    console.error('Image generation failed:', error);
    await bot.sendMessage(chatId, 'Sorry, I could not generate an image right now.');
  }
});

bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log('Telegram image bot is running...');
