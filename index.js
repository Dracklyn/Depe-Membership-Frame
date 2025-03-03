require('dotenv').config();
const express = require('express');
const Web3 = require('web3');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3001;

// Primary domain for Vercel
const DEPLOYED_URL = 'https://553d-91-65-203-172.ngrok-free.app';

// Load and validate environment variables
const DEPE_CONTRACT_ADDRESS = process.env.DEPE_CONTRACT_ADDRESS;
const MOD_FID = parseInt(process.env.MOD_FID);
const FARCASTER_API_KEY = process.env.FARCASTER_API_KEY;
const DEGEN_RPC_URL = process.env.DEGEN_RPC_URL;

// Validate required environment variables
if (!DEPE_CONTRACT_ADDRESS) throw new Error('DEPE_CONTRACT_ADDRESS is required');
if (!MOD_FID) throw new Error('MOD_FID is required');
if (!FARCASTER_API_KEY) throw new Error('FARCASTER_API_KEY is required');
if (!DEGEN_RPC_URL) throw new Error('DEGEN_RPC_URL is required');

console.log('Initializing with configuration:');
console.log('- DEPE Contract:', DEPE_CONTRACT_ADDRESS);
console.log('- RPC URL:', DEGEN_RPC_URL);
console.log('- MOD_FID:', MOD_FID);

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
        console.log('No wallet address provided');
        return res.send(generateFrame('No wallet address provided', 'Try Again'));
    }

    try {
        // Create contract instance
        console.log('Creating contract instance for:', DEPE_CONTRACT_ADDRESS);
        const contract = new web3.eth.Contract(ERC20_ABI, DEPE_CONTRACT_ADDRESS);
        
        // Get balance
        console.log('Fetching balance for address:', walletAddress);
        const balance = await contract.methods.balanceOf(walletAddress).call();
        const balanceInTokens = web3.utils.fromWei(balance, 'ether');
        console.log(`Balance for ${walletAddress}: ${balanceInTokens} DEPE`);

        if (parseFloat(balanceInTokens) >= 50) {
            console.log('Balance sufficient, sending invite');
            try {
                const inviteResult = await sendChannelInvite(walletAddress);
                console.log('Invite sent successfully:', inviteResult);
                return res.send(generateFrame('✅ Invite sent! Check your Warpcast notifications.', 'Done', 'success'));
            } catch (inviteError) {
                console.error('Error sending invite:', inviteError);
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
                <meta property="fc:frame:button:1:action" content="post_redirect" />
                <meta property="fc:frame:post_url" content="${DEPLOYED_URL}/connect" />
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
    console.log('Sending channel invite for wallet:', walletAddress);
    try {
        // Send the channel invite using Warpcast API
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

        console.log('Invite API response:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error in sendChannelInvite:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// Start server
app.listen(port, () => {
    console.log(`
Server started successfully:
- Environment: ${process.env.NODE_ENV || 'development'}
- Port: ${port}
- URL: ${DEPLOYED_URL}
    `);
});