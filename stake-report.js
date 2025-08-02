// Contract address will be set dynamically based on network
let contractAddress;
const MAX_STAKES_PER_TIER = 369;

let web3, contract, abi;

async function loadABI() {
    try {
        const response = await fetch('./HexRewards.json');
        const HexRewardsArtifact = await response.json();
        abi = HexRewardsArtifact.abi;
    } catch (error) {
        console.error('Error loading HexRewards ABI:', error);
    }
}

async function initWeb3() {
    if (typeof window.ethereum !== 'undefined') {
        web3 = new Web3(window.ethereum);
        
        // Get configuration based on current network
        const config = await getConfig();
        contractAddress = config.hexRewardsAddress;
        
        contract = new web3.eth.Contract(abi, contractAddress);
    } else {
        alert('Please install MetaMask to use this dApp!');
    }
}

async function queryAddress() {
    const address = document.getElementById('addressInput').value;
    if (!web3.utils.isAddress(address)) {
        alert('Invalid Ethereum address');
        return;
    }

    document.getElementById('reportAddress').textContent = address;
    document.getElementById('reportContent').style.display = 'block';

    await getTokenBalance(address);
    await getStakeList(address);
}

async function getTokenBalance(address) {
    try {
        const balance = await contract.methods.balanceOf(address).call();
        const formattedBalance = parseFloat(web3.utils.fromWei(balance, 'ether')).toFixed(6);
        document.getElementById('tokenBalance').innerHTML = `HexReward Balance: ${formattedBalance}`;
    } catch (error) {
        console.error('Failed to retrieve token balance:', error);
        document.getElementById('tokenBalance').innerHTML = 'Failed to retrieve balance';
    }
}

async function getStakeList(address) {
    try {
        const stakeList = await contract.methods.getStakeList(address).call();
        displayStakeList(stakeList, address);
    } catch (error) {
        console.error('Error retrieving stake list:', error);
        alert('Failed to retrieve stake list. Please check the console for more information.');
        displayStakeList([], address);
    }
}

async function displayStakeList(stakeList, address) {
    const stakeListElement = document.getElementById('stakeList');
    stakeListElement.innerHTML = '';

    if (!stakeList || stakeList.length === 0) {
        stakeListElement.innerHTML = '<p>No stakes found.</p>';
        return;
    }

    const table = document.createElement('table');
    const headerRow = document.createElement('tr');
    const headers = ['Stake Index', 'Stake ID', 'Staked Hex', 'Stake B-Shares', 'Locked Day', 'Staked Days', 'Consumed Days', 'Early Reward', 'Finished Reward', 'Claimed Reward', 'Return Reward Fee'];

    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });

    table.appendChild(headerRow);

    const rowPromises = stakeList.map(async (stake, index) => {
        const row = document.createElement('tr');
        const consumedDays = await contract.methods.calculateConsumedDays(stake.lockedDay, stake.stakedDays).call();
        const claimedReward = await contract.methods.getClaimedReward(address, index).call();
        const earlyReward = await contract.methods.calculateReward(consumedDays, stake.stakedDays, stake.unlockedDay).call();
        const finishedReward = await contract.methods.calculateReward(stake.stakedDays, stake.stakedDays, 1).call();

        // Calculate Return Reward Fee
        const returnRewardFee = claimedReward !== '0' 
            ? (parseFloat(web3.utils.fromWei(earlyReward, 'ether')) * 1.3).toFixed(6)
            : 'N/A';

        const values = [
            index,
            stake.stakeId,
            formatBigIntWithDecimals(stake.stakedHearts, 8, 3),
            formatBigIntWithDecimals(stake.stakeShares, 9, 3),
            stake.lockedDay,
            stake.stakedDays,
            consumedDays,
            web3.utils.fromWei(earlyReward, 'ether'),
            web3.utils.fromWei(finishedReward, 'ether'),
            web3.utils.fromWei(claimedReward, 'ether'),
            returnRewardFee
        ];

        values.forEach(value => {
            const td = document.createElement('td');
            td.textContent = value;
            row.appendChild(td);
        });

        return row;
    });

    const rows = await Promise.all(rowPromises);
    rows.forEach(row => table.appendChild(row));

    stakeListElement.appendChild(table);
}


function formatBigIntWithDecimals(bigInt, divisor, decimalPlaces) {
    const bigIntString = bigInt.toString();
    const length = bigIntString.length;
    const integerPart = bigIntString.slice(0, length - divisor);
    const fractionalPart = bigIntString.slice(length - divisor);
    const formattedString = `${integerPart}.${fractionalPart.slice(0, decimalPlaces)}`;
    return parseFloat(formattedString).toFixed(decimalPlaces);
}

function getStakeStatus(stake, claimedReward, consumedDays) {
    if (claimedReward !== '0') {
        return 'Claimed';
    } else if (consumedDays >= stake.stakedDays) {
        return 'Mature';
    } else {
        return 'Active';
    }
}

async function init() {
    await loadABI();
    await initWeb3();
}

document.getElementById('queryAddressBtn').addEventListener('click', queryAddress);
window.addEventListener('load', init);
