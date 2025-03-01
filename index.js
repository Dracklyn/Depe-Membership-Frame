require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const axios = require('axios');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('views'));

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
  res.sendFile(__dirname + '/views/frame.html');
});

// Handle Frame POST requests
app.post('/', async (req, res) => {
  const { untrustedData } = req.body;
  const buttonId = untrustedData?.buttonIndex;
  const walletAddress = untrustedData?.address;

  if (!buttonId) {
    return res.send(generateFrame('Something went wrong. Try again.', 'Request to Join'));
  }

  if (buttonId === 1) {
    // Button 1: Request to Join
    if (!walletAddress) {
      return res.send(generateFrame('Please connect your wallet', 'Request to Join'));
    }

    const provider = new ethers.providers.JsonRpcProvider(DEGEN_RPC_URL);
    const contract = new ethers.Contract(DEPE_CONTRACT_ADDRESS, ERC20_ABI, provider);
    const balance = await contract.balanceOf(walletAddress);
    const balanceInTokens = ethers.utils.formatUnits(balance, 18);

    if (parseFloat(balanceInTokens) >= 50) {
      try {
        await sendChannelInvite(walletAddress);
        return res.send(generateFrame('Invite sent! Check your Warpcast.', 'Request to Join'));
      } catch (error) {
        return res.send(generateFrame('Failed to send invite. Try again.', 'Request to Join'));
      }
    } else {
      return res.send(generateFrame(`You hold ${balanceInTokens} DEPE. Need 50+ to join.`, 'Request to Join'));
    }
  }
});

// Generate Frame HTML
function generateFrame(message, buttonText) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="https://res.cloudinary.com/verifiedcreators/image/upload/v1739232925/DEPE/DEPE-Banner-Bg_bk79ec.png?text=${encodeURIComponent(message)}" />
        <meta property="fc:frame:button:1" content="${buttonText}" />
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
  return response.data;
}

app.listen(port, () => {
  console.log(`Frame server running at http://localhost:${port}`);
});