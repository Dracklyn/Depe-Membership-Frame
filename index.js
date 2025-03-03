require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const axios = require('axios');
const app = express();
const port = 3000;

// Primary domain for Vercel
const DEPLOYED_URL = 'https://depe-membership-frame.vercel.app';

app.use(express.json());
app.use(express.static('views')); // Serve static files from 'views'

// Load environment variables
const DEPE_CHANNEL_URL = process.env.DEPE_CHANNEL_URL;
const DEPE_CONTRACT_ADDRESS = process.env.DEPE_CONTRACT_ADDRESS;
const MOD_FID = parseInt(process.env.MOD_FID);
const MOD_PUBLIC_KEY = process.env.MOD_PUBLIC_KEY;
const MOD_PRIVATE_KEY = process.env.MOD_PRIVATE_KEY;
const FARCASTER_API_KEY = process.env.FARCASTER_API_KEY;
const DEGEN_RPC_URL = process.env.DEGEN_RPC_URL;

// ERC-20 ABI for balanceOf function
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

// Initial Frame
app.get('/', (req, res) => {
  console.log('Serving initial frame');
  res.sendFile(__dirname + '/views/frame.html');
});

// Wallet Connect Endpoint
app.get('/connect', (req, res) => {
  console.log('Serving wallet connect page');
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Connect Wallet</title>
        <script src="/ethers.umd.min.js"></script>
      </head>
      <body>
        <h1>Connect Your EVM Wallet</h1>
        <button onclick="connectWallet()">Connect Wallet</button>
        <script>
          function connectWallet() {
            if (typeof ethers === 'undefined') {
              alert('ethers.js failed to load. Please refresh the page.');
              return;
            }
            if (!window.ethereum) {
              alert('Please install an EVM wallet (e.g., MetaMask, Rainbow, Coinbase Wallet)!');
              return;
            }
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            provider.send("eth_requestAccounts", [])
              .then(accounts => {
                const address = accounts[0];
                window.location.href = '${DEPLOYED_URL}/process?address=' + address;
              })
              .catch(error => {
                alert('Failed to connect wallet: ' + error.message);
              });
          }
          // Auto-trigger wallet connection when ethers is loaded
          window.onload = function() {
            if (typeof ethers !== 'undefined') {
              connectWallet();
            } else {
              console.error('ethers.js not loaded yet');
              setTimeout(connectWallet, 500); // Retry after 500ms
            }
          };
        </script>
      </body>
    </html>
  `);
});

// Process Wallet Address and Return to Frame
app.get('/process', async (req, res) => {
  const walletAddress = req.query.address;
  console.log('Processing address:', walletAddress);

  if (!walletAddress) {
    return res.send(generateFrame('No wallet address provided. Try again.', 'Request to Join', 'https://res.cloudinary.com/verifiedcreators/image/upload/v1739232925/DEPE/DEPE-Banner-Bg_bk79ec.png'));
  }

  try {
    const provider = new ethers.providers.JsonRpcProvider(DEGEN_RPC_URL);
    const contract = new ethers.Contract(DEPE_CONTRACT_ADDRESS, ERC20_ABI, provider);
    const balance = await contract.balanceOf(walletAddress);
    const balanceInTokens = ethers.utils.formatUnits(balance, 18);
    console.log(`Balance for ${walletAddress}: ${balanceInTokens} DEPE`);

    if (parseFloat(balanceInTokens) >= 50) {
      console.log('Balance sufficient, sending invite');
      await sendChannelInvite(walletAddress);
      return res.send(generateFrame('Invite sent! Check your Warpcast.', 'Done', 'https://via.placeholder.com/600x400?text=Invite+Sent'));
    } else {
      console.log('Insufficient balance');
      return res.send(generateFrame(`You hold ${balanceInTokens} DEPE. Need 50+ to join.`, 'Try Again', 'https://via.placeholder.com/600x400?text=Insufficient+Balance'));
    }
  } catch (error) {
    console.error('Error in /process:', error.message);
    return res.send(generateFrame('Failed to process. Try again.', 'Request to Join', 'https://via.placeholder.com/600x400?text=Error'));
  }
});

// Handle Frame POST requests (fallback)
app.post('/', (req, res) => {
  console.log('POST request received:', JSON.stringify(req.body, null, 2));
  return res.send(generateFrame('Please use the connect flow.', 'Request to Join', 'https://res.cloudinary.com/verifiedcreators/image/upload/v1739232925/DEPE/DEPE-Banner-Bg_bk79ec.png'));
});

// Generate Frame HTML
function generateFrame(message, buttonText, imageUrl) {
  const postUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : DEPLOYED_URL;
  console.log(`Generating frame with postUrl: ${postUrl}, image: ${imageUrl}`);
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${imageUrl}" />
        <meta property="fc:frame:button:1" content="${buttonText}" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content="${DEPLOYED_URL}/connect" />
      </head>
    </html>
  `;
}

// Send Channel Invite using Farcaster Hub and Warpcast API
async function sendChannelInvite(walletAddress) {
  const hubUrl = 'https://nemes.farcaster.xyz:2281';
  const hubResponse = await axios.get(`${hubUrl}/v1/user-by-address?address=${walletAddress.toLowerCase()}`);
  const userData = hubResponse.data;

  if (!userData || !userData.fid) {
    throw new Error('Could not find FID for this wallet address');
  }
  const userFid = userData.fid;
  console.log(`FID for ${walletAddress}: ${userFid}`);

  const response = await axios.post(
    'https://api.warpcast.com/fc/channel-invites',
    {
      channelId: 'depe',
      inviterFid: MOD_FID,
      inviteFid: userFid,
      role: 'member',
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FARCASTER_API_KEY}`,
      },
    }
  );
  console.log('Invite sent successfully');
  return response.data;
}

app.listen(port, () => {
  console.log(`Frame server running at http://localhost:${port}`);
});