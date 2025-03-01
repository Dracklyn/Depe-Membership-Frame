require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const axios = require('axios');
const app = express();
const port = 3000;

// Primary domain for Vercel
const DEPLOYED_URL = 'https://depe-membership-frame.vercel.app';

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
  console.log('Serving initial frame');
  res.sendFile(__dirname + '/views/frame.html');
});

// Handle Frame POST requests
app.post('/', async (req, res) => {
  console.log('POST request received:', JSON.stringify(req.body, null, 2));
  const { untrustedData } = req.body;
  const buttonId = untrustedData?.buttonIndex;
  const walletAddress = untrustedData?.address;

  if (!buttonId) {
    console.log('No buttonId, returning error');
    return res.send(generateFrame('Something went wrong. Try again.', 'Request to Join'));
  }

  if (buttonId === 1) {
    console.log('Button 1 clicked, walletAddress:', walletAddress);
    if (!walletAddress) {
      console.log('No wallet address, prompting connection');
      return res.send(generateFrame('Please connect your wallet', 'Request to Join'));
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
        return res.send(generateFrame('Invite sent! Check your Warpcast.', 'Request to Join'));
      } else {
        console.log('Insufficient balance');
        return res.send(generateFrame(`You hold ${balanceInTokens} DEPE. Need 50+ to join.`, 'Request to Join'));
      }
    } catch (error) {
      console.error('Error in POST handler:', error.message);
      return res.send(generateFrame('Failed to send invite. Try again.', 'Request to Join'));
    }
  }
});

// Generate Frame HTML
function generateFrame(message, buttonText) {
  const postUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : DEPLOYED_URL;
  console.log(`Generating frame with postUrl: ${postUrl}`);
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="https://res.cloudinary.com/verifiedcreators/image/upload/v1739232925/DEPE/DEPE-Banner-Bg_bk79ec.png" />
        <meta property="fc:frame:button:1" content="${buttonText}" />
        <meta property="fc:frame:post_url" content="${postUrl}" />
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