require('dotenv').config();
const axios = require('axios');

const express = require('express');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');

puppeteer.use(StealthPlugin());

const app = express();
const port = 3001;

const server = http.createServer(app);
const io = socketIo(server);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

app.use(bodyParser.json());
app.use(express.static('public'));

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

function sendEvent(socket, message) {
  if (socket && typeof socket.emit === 'function') {
    socket.emit('consoleMessage', message);
  } else {
    console.error('Socket is not properly initialized or does not have emit method.');
  }
}

app.post('/api/generate', async (req, res) => {
  const userInput = req.body.input;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(userInput);
    const response = await result.response;
    const text = await response.text();
    sendEvent(req.app.get('socket'), 'Generated response successfully.');
    res.json({ answer: text });
  } catch (error) {
    sendEvent(req.app.get('socket'), 'Error fetching data from Gemini API: ' + error.message);
    res.status(500).json({ error: 'Error fetching data from Gemini API' });
  }
});

app.post('/api/postTweet', async (req, res) => {
  const tweetText = req.body.tweet;
  const socket = req.app.get('socket');

  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-size=1920x1080',
        '--dns-prefetch-disable',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
      userDataDir: './temp'
    });

    const page = await browser.newPage();

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    sendEvent(socket, 'Waiting for username input...');
    await page.goto('https://twitter.com/login', { waitUntil: 'networkidle2' });

    async function lognin(params) {

      try {
        await page.waitForSelector('input[name="text"]', { visible: true, timeout: 60000 });
        await page.type('input[name="text"]', 'YashSha73564414');
        await page.keyboard.press('Enter');
        await page.waitForSelector('input[name="text"]', { visible: true, timeout: 60000 });
        await page.type('input[name="text"]', 'yash11122er@gmail.com');
        await page.keyboard.press('Enter');

        sendEvent(socket, 'Waiting for password input...');
        await page.waitForSelector('input[name="password"]', { visible: true, timeout: 60000 });
        await page.type('input[name="password"]', 'yshah123r');
        await page.keyboard.press('Enter');

        sendEvent(socket, 'Taking screenshot...');

        setTimeout(async () => {
          const screenshotPath = path.join(__dirname, 'public', 'screenshot.png');
          await page.screenshot({ path: screenshotPath, fullPage: true });
        }, 3000); // 3000 milliseconds = 3 seconds

        sendEvent(socket, 'Screenshot taken and saved successfully!');
        sendEvent(socket, 'Waiting for navigation after login...');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
      } catch (error) {
        console.log('login error');
      }

      sendEvent(socket, 'Login successful!');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(page.url())
    if (page.url().includes('/home')) {
      sendEvent(socket, 'Login skipped');
    }

    lognin();

    await page.waitForSelector('div[data-testid="tweetTextarea_0"]', { visible: true, timeout: 0 });
    await page.type('div[data-testid="tweetTextarea_0"]', tweetText);
    await page.waitForSelector('button[data-testid="tweetButtonInline"]', { visible: true, timeout: 60000 });
    await page.click('button[data-testid="tweetButtonInline"]');

    sendEvent(socket, 'Tweet posted successfully!');
    await browser.close();

    res.json({ status: 'Tweet posted successfully!' });
  } catch (error) {
    sendEvent(socket, 'Error posting tweet: ' + error.message);
    res.status(500).json({ error: 'Error posting tweet' });
  }
});


app.post('/api/postTweetWithImage', upload.single('image'), async (req, res) => {
  const description = req.body.description;
  const image = req.file;
  const imageUrl = req.body.imageUrl;
  const socket = req.app.get('socket');

  let downloadedImagePath = null;

  try {
    if (imageUrl) {
      console.log('Downloading image from URL...');
      const response = await axios({
        url: imageUrl,
        responseType: 'stream',
      });
      const imagePath = path.join(__dirname, 'uploads', 'downloaded_image.jpg');
      downloadedImagePath = imagePath;
      const writer = fs.createWriteStream(imagePath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      console.log('Image downloaded successfully!');
    }

    const browser = await puppeteer.launch({
      headless: "new", // Set to true for production
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-size=1920x1080',
        '--dns-prefetch-disable',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
      userDataDir: './temp'
    });
    const page = await browser.newPage();

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    console.log('Waiting for username input...');
    await page.goto('https://twitter.com/login', { waitUntil: 'networkidle2' });

    async function login() {
      try {
        await page.waitForSelector('input[name="session[username_or_email]"]', { visible: true, timeout: 60000 });
        await page.type('input[name="session[username_or_email]"]', 'your_twitter_username_or_email');
        await page.keyboard.press('Enter');

        console.log('Waiting for password input...');
        await page.waitForSelector('input[name="session[password]"]', { visible: true, timeout: 60000 });
        await page.type('input[name="session[password]"]', 'your_twitter_password');
        await page.keyboard.press('Enter');

        console.log('Taking screenshot...');
        setTimeout(async () => {
          const screenshotPath = path.join(__dirname, 'public', 'screenshot.png');
          await page.screenshot({ path: screenshotPath, fullPage: true });
        }, 3000); // 3000 milliseconds = 3 seconds

        console.log('Screenshot taken and saved successfully!');
        console.log('Waiting for navigation after login...');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
      } catch (error) {
        console.log('login error', error);
      }

      console.log('Login successful!');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(page.url());
    if (page.url().includes('/home')) {
      console.log('Login skipped');
    } else {
      await login();
    }

    await page.waitForSelector('div[data-testid="tweetTextarea_0"]', { visible: true, timeout: 0 });
    await page.type('div[data-testid="tweetTextarea_0"]', description);

    if (image || downloadedImagePath) {
      const imagePath = image ? path.join(__dirname, image.path) : downloadedImagePath;
      console.log(`Image path: ${imagePath}`);

      await page.waitForSelector('input[data-testid="fileInput"]', { visible: true });
      const fileInput = await page.$('input[data-testid="fileInput"]');
      await fileInput.uploadFile(imagePath);

      console.log('Image uploaded successfully!');
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Wait for the tweet button to be visible and clickable
      await page.waitForSelector('button[data-testid="tweetButtonInline"]', { visible: true, timeout: 60000 });
      await page.click('button[data-testid="tweetButtonInline"]');
      await new Promise(resolve => setTimeout(resolve, 6000));
      console.log('Tweet posted successfully!');
    }

    await browser.close();

    res.json({ status: 'Tweet posted successfully!' });
  } catch (error) {
    console.error('Error posting tweet:', error.message);
    res.status(500).json({ error: 'Error posting tweet' });
  } finally {
    if (image) {
      fs.unlink(image.path, (err) => {
        if (err) console.error('Failed to delete image file:', err);
      });
    }
    if (downloadedImagePath) {
      fs.unlink(downloadedImagePath, (err) => {
        if (err) console.error('Failed to delete downloaded image file:', err);
      });
    }
  }
});



app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('a user connected');
  app.set('socket', socket);

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

server.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});