require('dotenv').config();
const express = require('express');
const Web3 = require('web3');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Primary domain for Vercel
const DEPLOYED_URL = 'https://depe-membership-frame.vercel.app';

// Load environment variables
const DEPE_CONTRACT_ADDRESS = process.env.DEPE_CONTRACT_ADDRESS;
const MOD_FID = parseInt(process.env.MOD_FID);
const FARCASTER_API_KEY = process.env.FARCASTER_API_KEY;
const DEGEN_RPC_URL = process.env.DEGEN_RPC_URL;

// Initialize Web3
const web3 = new Web3(new Web3.providers.HttpProvider(DEGEN_RPC_URL));

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
app.use(express.static('views'));

// Initial Frame
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/frame.html');
});

// Wallet Connect Endpoint
app.get('/connect', (req, res) => {
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
                const inviteResult = await sendChannelInvite(walletAddress);
                console.log('Invite result:', inviteResult);
                return res.send(generateFrame('✅ Invite sent! Check your Warpcast notifications.', 'Done', 'success'));
            } catch (inviteError) {
                console.error('Invite error:', inviteError);
                return res.send(generateFrame('❌ Error sending invite. Make sure you have a Farcaster account.', 'Try Again', 'error'));
            }
        } else {
            console.log('Insufficient balance');
            return res.send(generateFrame(`❌ You need 50+ DEPE to join. Current balance: ${balanceInTokens} DEPE`, 'Try Again', 'warning'));
        }
    } catch (error) {
        console.error('Process error:', error);
        return res.send(generateFrame('❌ Error checking DEPE balance. Please try again.', 'Try Again', 'error'));
    }
});

// Generate Frame HTML with different status images
function generateFrame(message, buttonText, status = 'default') {
    let imageUrl;
    switch (status) {
        case 'success':
            imageUrl = 'https://res.cloudinary.com/verifiedcreators/image/upload/v1739232925/DEPE/success_banner.png';
            break;
        case 'error':
            imageUrl = 'https://res.cloudinary.com/verifiedcreators/image/upload/v1739232925/DEPE/error_banner.png';
            break;
        case 'warning':
            imageUrl = 'https://res.cloudinary.com/verifiedcreators/image/upload/v1739232925/DEPE/warning_banner.png';
            break;
        default:
            imageUrl = 'https://res.cloudinary.com/verifiedcreators/image/upload/v1739232925/DEPE/DEPE-Banner-Bg_bk79ec.png';
    }

    return `
        <!DOCTYPE html>
        <html>
            <head>
                <meta property="fc:frame" content="vNext" />
                <meta property="fc:frame:image" content="${imageUrl}" />
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

// Send Channel Invite using Warpcast API
async function sendChannelInvite(walletAddress) {
    try {
        // Get the user's FID from their wallet address
        const response = await axios.post(
            'https://api.warpcast.com/v2/channel-members',
            {
                channelId: 'depe',
                address: walletAddress.toLowerCase(),
                role: 'member'
            },
            {
                headers: {
                    'Authorization': `Bearer ${FARCASTER_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Invite sent successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error in sendChannelInvite:', error.response ? error.response.data : error.message);
        throw error;
    }
}

app.listen(port, () => {
    console.log(`Frame server running at http://localhost:${port}`);
});