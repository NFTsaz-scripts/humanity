require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const readline = require("readline");

// ABI for the function you want to call
const IMPLEMENTATION_ABI = [
    {
        "inputs": [],
        "name": "claimReward",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

const PROXY_ADDRESS = "0xa18f6FCB2Fd4884436d10610E69DB7BFa1bFe8C7"; // Proxy contract address
const NETWORK_URL = "https://rpc.testnet.humanity.org"; // Your RPC URL
const PRIVATE_KEY_FILE = path.join(__dirname, "private_key.txt");
const LAST_CLAIM_FILE = path.join(__dirname, "lastClaimTime.txt");
const FAUCET_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
const CLAIM_INTERVAL_MS = 25 * 60 * 60 * 1000; // 25 hours in milliseconds

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to prompt user for private key and save it
async function getOrCreatePrivateKey() {
    if (fs.existsSync(PRIVATE_KEY_FILE)) {
        return fs.readFileSync(PRIVATE_KEY_FILE, "utf-8").trim();
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question("Enter your wallet private key: ", (privateKey) => {
            fs.writeFileSync(PRIVATE_KEY_FILE, privateKey.trim());
            rl.close();
            resolve(privateKey.trim());
        });
    });
}

// Function to get the last claim time
function getLastClaimTime() {
    if (fs.existsSync(LAST_CLAIM_FILE)) {
        const lastClaimTime = parseInt(fs.readFileSync(LAST_CLAIM_FILE, "utf-8"), 10);
        if (!isNaN(lastClaimTime)) {
            return lastClaimTime;
        }
    }
    return 0;
}

// Function to update the last claim time
function updateLastClaimTime() {
    const currentTime = Date.now();
    fs.writeFileSync(LAST_CLAIM_FILE, currentTime.toString());
}

// Function to claim faucet
async function sendFaucetRequest(walletAddress) {
    const URL = "https://faucet.testnet.humanity.org/api/claim";
    const payload = { address: walletAddress };

    try {
        const response = await axios.post(URL, payload);
        console.log(`Faucet claim for ${walletAddress}:`, response.data.msg);
    } catch (error) {
        console.error(`Faucet error for ${walletAddress}:`, error.message);
    }
}

// Function to call the claimReward function
async function claimReward(privateKey) {
    try {
        const lastClaimTime = getLastClaimTime();
        const currentTime = Date.now();

        if (currentTime - lastClaimTime < CLAIM_INTERVAL_MS) {
            console.log("Skipping contract claim, not enough time has passed.");
            return;
        }

        const provider = new ethers.JsonRpcProvider(NETWORK_URL);
        const wallet = new ethers.Wallet(privateKey, provider);

        console.log(`Using wallet: ${wallet.address}`);

        const contract = new ethers.Contract(PROXY_ADDRESS, IMPLEMENTATION_ABI, wallet);
        const data = contract.interface.encodeFunctionData("claimReward");

        const tx = {
            to: PROXY_ADDRESS,
            data: data,
            gasLimit: ethers.parseUnits("1000000", "wei"),
            gasPrice: await provider.getGasPrice(),
            nonce: await provider.getTransactionCount(wallet.address)
        };

        console.log("Sending claimReward transaction...");
        const txResponse = await wallet.sendTransaction(tx);
        console.log(`Transaction sent. Hash: ${txResponse.hash}`);

        await txResponse.wait();
        console.log("Transaction confirmed!");

        updateLastClaimTime();
    } catch (error) {
        console.error("Error in claimReward:", error.message);
    }
}

// Main function to handle periodic tasks
async function main() {
    const privateKey = await getOrCreatePrivateKey();
    const provider = new ethers.JsonRpcProvider(NETWORK_URL);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Run faucet and claim reward on startup
    await sendFaucetRequest(wallet.address);
    await claimReward(privateKey);

    // Schedule faucet every 2 hours
    setInterval(() => sendFaucetRequest(wallet.address), FAUCET_INTERVAL_MS);

    // Schedule contract claim every 25 hours
    setInterval(() => claimReward(privateKey), CLAIM_INTERVAL_MS);
}

main();
