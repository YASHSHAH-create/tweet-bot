require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const app = express();
const port = 3000;

const server = http.createServer(app);
const io = socketIo(server);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

app.use(bodyParser.json());
app.use(express.static('public'));

function sendEvent(socket, message) {
  socket.emit('consoleMessage', message);
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
      headless: 'new',
      executablePath: '/usr/bin/google-chrome', // Path where Google Chrome is installed
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

    // Set custom DNS server (optional)
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
      
    // sendEvent(socket, 'Attempting to post tweet...');
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