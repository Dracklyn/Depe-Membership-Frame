require('dotenv').config();
const express = require('express');
const Web3 = require('web3');
const axios = require('axios');
const app = express();
const port = 3000;

// Primary domain for Vercel
const DEPLOYED_URL = 'https://depe-membership-frame.vercel.app';

// Load environment variables
const DEPE_CHANNEL_URL = process.env.DEPE_CHANNEL_URL;
const DEPE_CONTRACT_ADDRESS = process.env.DEPE_CONTRACT_ADDRESS;
const MOD_FID = parseInt(process.env.MOD_FID);
const MOD_PUBLIC_KEY = process.env.MOD_PUBLIC_KEY;
const MOD_PRIVATE_KEY = process.env.MOD_PRIVATE_KEY;
const FARCASTER_API_KEY = process.env.FARCASTER_API_KEY;
const DEGEN_RPC_URL = process.env.DEGEN_RPC_URL;

// Initialize Web3
const web3 = new Web3(DEGEN_RPC_URL);

// ERC-20 ABI for balanceOf function
const ERC20_ABI = [
    {
        "constant": true,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    }
];

app.use(express.json());
app.use(express.static('views')); // Serve static files from 'views'

// Initial Frame
app.get('/', (req, res) => {
    console.log('Serving initial frame');
    res.sendFile(__dirname + '/views/frame.html');
});

// Wallet Connect Endpoint
app.get('/connect', (req, res) => {
    console.log('Serving wallet connect page');
    res.sendFile(__dirname + '/views/connect.html');
});

// Process Wallet Address and Return to Frame
app.get('/process', async (req, res) => {
    const walletAddress = req.query.address;
    console.log('Processing address:', walletAddress);

    if (!walletAddress) {
        return res.send(generateFrame('No wallet address provided', 'Try Again'));
    }

    try {
        // Create contract instance
        const contract = new web3.eth.Contract(ERC20_ABI, DEPE_CONTRACT_ADDRESS);
        
        // Get balance
        const balance = await contract.methods.balanceOf(walletAddress).call();
        const balanceInTokens = web3.utils.fromWei(balance, 'ether');
        console.log(`Balance for ${walletAddress}: ${balanceInTokens} DEPE`);

        if (parseFloat(balanceInTokens) >= 50) {
            console.log('Balance sufficient, sending invite');
            try {
                await sendChannelInvite(walletAddress);
                return res.send(generateFrame('Invite sent! Check your Warpcast.', 'Done'));
            } catch (inviteError) {
                console.error('Invite error:', inviteError);
                return res.send(generateFrame('Error sending invite. Please try again.', 'Try Again'));
            }
        } else {
            console.log('Insufficient balance');
            return res.send(generateFrame(`You need 50+ DEPE to join. Current balance: ${balanceInTokens} DEPE`, 'Try Again'));
        }
    } catch (error) {
        console.error('Process error:', error);
        return res.send(generateFrame('Error processing request. Please try again.', 'Try Again'));
    }
});

// Handle Frame POST requests (fallback)
app.post('/', (req, res) => {
    console.log('POST request received:', JSON.stringify(req.body, null, 2));
    return res.send(generateFrame('Please use the connect flow.', 'Request to Join'));
});

// Generate Frame HTML
function generateFrame(message, buttonText) {
    return `
        <!DOCTYPE html>
        <html>
            <head>
                <meta property="fc:frame" content="vNext" />
                <meta property="fc:frame:image" content="https://res.cloudinary.com/verifiedcreators/image/upload/v1739232925/DEPE/DEPE-Banner-Bg_bk79ec.png" />
                <meta property="fc:frame:button:1" content="${buttonText}" />
                <meta property="fc:frame:button:1:action" content="link" />
                <meta property="fc:frame:button:1:target" content="${DEPLOYED_URL}/connect" />
                <title>DEPE Channel Access</title>
            </head>
            <body>
                <div style="display: none;">${message}</div>
            </body>
        </html>
    `;
}

// Send Channel Invite using Farcaster Hub and Warpcast API
async function sendChannelInvite(walletAddress) {
    try {
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
    } catch (error) {
        console.error('Error sending invite:', error);
        throw error;
    }
}

app.listen(port, () => {
    console.log(`Frame server running at http://localhost:${port}`);
});