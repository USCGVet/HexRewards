// Terminal CD frontend
// Terminal http-server

const contractAddress = '0x793956DC380e2eeC5B59f674f31953c153ccCc0e'; // Replace with your contract address

let web3, contract, accounts, abi;

async function loadABI() {
    try {
      const response = await fetch('./HexRewards.json');
      const HexRewardsArtifact = await response.json();
      abi = HexRewardsArtifact.abi;
    } catch (error) {
      console.error('Error loading HexRewards ABI:', error);
    }
  }

  
async function connectToMetaMask() {
    await loadABI();

    if (typeof window.ethereum !== 'undefined') {
        web3 = new Web3(window.ethereum);
        try {
            accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            contract = new web3.eth.Contract(abi, contractAddress);
            document.getElementById('accountInfo').innerHTML = `Connected: ${accounts[0]}`;            
            await getTokenBalance(); 
            document.getElementById('mainContent').style.display = 'block'; // Show the main content
            document.getElementById('tokenBalanceHeader').style.display = 'block';
            document.getElementById('connectButton').style.display = 'none';
            document.getElementById('connectAddr').style.display = 'block';

            await getNetwork();
            await getStakeList();

        } catch (error) {
            console.error(error);
        }
    } else {
        alert('Please install MetaMask to interact with this dApp!');
    }
}

async function getTotalTokenSupply() {
    try {
        const totalSupply = await contract.methods.totalSupply().call();
        const formattedTotalSupply = parseFloat(web3.utils.fromWei(totalSupply, 'ether')).toFixed(8);
        document.getElementById('totalTokenSupply').innerHTML = `Total HexReward Supply: ${formattedTotalSupply}`;
    } catch (error) {
        console.error('Failed to fetch total token supply:', error);
    }
}

async function getTokenBalance() {
    try {
        const tokenAddress = contractAddress; 
        const tokenContract = new web3.eth.Contract(abi, tokenAddress);
        const balance = await tokenContract.methods.balanceOf(accounts[0]).call();
        const formattedBalance = parseFloat(web3.utils.fromWei(balance, 'ether')).toFixed(8);
        document.getElementById('tokenBalance').innerHTML = `Your HexReward Balance: ${formattedBalance}`;
        await getTotalTokenSupply();  // Fetch and display total supply
    } catch (error) {
        console.error(error);
        alert('Failed to retrieve token balance. Please check the console for more information.');
    }
}

async function getNetwork(){
    // Check if MetaMask is installed
    if (typeof window.ethereum !== 'undefined') {
      // Access the MetaMask provider
      const ethereum = window.ethereum;

      // Retrieve the network ID
      ethereum.request({ method: 'net_version' })
        .then(networkId => {
          // Map network ID to network name
          let networkName;
          switch (networkId) {
            case '1':
              networkName = 'Mainnet';
              break;
            case '3':
              networkName = 'Ropsten';
              break;
            case '4':
              networkName = 'Rinkeby';
              break;
            case '5':
              networkName = 'Goerli';
              break;
            case '42':
              networkName = 'Kovan';
              break;
            case '369':
              networkName = 'PulseChain Mainnet';
              break;  
            case '943':
              networkName = 'PulseChain Testnet v4';
              break;  
            default:
              networkName = 'Unknown';
          }
          document.getElementById('networkInfo').innerHTML = `Connected: ${networkName}`;
          // Display network name in your DApp's UI
          console.log('Connected to ' + networkName);
        })
        .catch(error => {
          console.error('Error fetching network ID:', error);
        });
    } else {
      console.error('MetaMask is not installed');
    }
}

async function claimReward(stakeIndex) {
    try {
      await contract.methods.claimReward(stakeIndex).send({ from: accounts[0] });
      alert('Reward claimed successfully!');
      await getTokenBalance(); // Refresh token balance in the header
      await getStakeList(); // Refresh the stake list in the grid
    } catch (error) {
      console.error(error);
      alert('Failed to claim reward. Please check the console for more information.');
    }
}

async function returnReward(stakeIndex, amtReturned) {
    const amount = amtReturned;
    try {
      const currentBalance = await contract.methods.balanceOf(accounts[0]).call();
        
      if (BigInt(currentBalance) > BigInt(amount)) {
          await contract.methods.returnReward(stakeIndex, amount).send({ from: accounts[0] });
          alert('Reward returned successfully!');
          await getTokenBalance(); // Refresh token balance in the header
          await getStakeList(); // Refresh the stake list in the grid
      } else {
          alert('Insufficient balance to return the reward.');
      }
    } catch (error) {
      console.error(error);
      alert('Failed to return reward. Please check the console for more information.');
    }
}


async function getStakeList() {
    console.log('Calling getStakeList function...');
    try {
      const theStakeList = await contract.methods.getStakeList(accounts[0]).call();
      console.log('Stake list retrieved:', theStakeList);
      displayStakeList(theStakeList);
    } catch (error) {
      console.error('Error retrieving stake list:', error);
      alert('Failed to retrieve stake list. Please check the console for more information.');
    }
  }

async function displayStakeList(stakeList) {
    const stakeListElement = document.getElementById('stakeList');
    stakeListElement.innerHTML = '';
  
    if (stakeList.length === 0) {
      stakeListElement.innerHTML = '<p>No stakes found.</p>';
      return;
    }
  
    const table = document.createElement('table');
    const headerRow = document.createElement('tr');
    const headers = ['Stake ID', 'Staked Hearts', 'Stake Shares', 'Locked Day', 'Staked Days', 'Unlocked Day', 'Auto Stake', 'Consumed Days', 'Early Reward', 'Finished Reward', 'Claimed Reward', 'Register', 'Claim Reward', 'Return Reward'];
  
    headers.forEach(header => {
      const th = document.createElement('th');
      th.textContent = header;
      headerRow.appendChild(th);
    });
  
    table.appendChild(headerRow);
  
    for (let i = 0; i < stakeList.length; i++) {
      const stake = stakeList[i];
      const consumedDays = await contract.methods.calculateConsumedDays(stake.lockedDay, stake.stakedDays).call();
  
      let claimedReward, earlyReward, finishedReward;
      try {
        claimedReward = await contract.methods.getClaimedReward(accounts[0], parseInt(i)).call();
        earlyReward = await contract.methods.calculateReward(consumedDays, stake.stakedDays, stake.unlockedDay).call();
        finishedReward = await contract.methods.calculateReward(stake.stakedDays, stake.stakedDays, 1).call();
      } catch (error) {
        console.error('Error retrieving claimed reward:', error);
        claimedReward = '0';
        earlyReward = '0';
        finishedReward = '0';
      }
  
      const row = document.createElement('tr');
      const values = [
        stake.stakeId,
        stake.stakedHearts,
        stake.stakeShares,
        stake.lockedDay,
        stake.stakedDays,
        stake.unlockedDay,
        stake.isAutoStake,
        consumedDays,
        web3.utils.fromWei(earlyReward, 'ether'),
        web3.utils.fromWei(finishedReward, 'ether'),
        web3.utils.fromWei(claimedReward, 'ether')
      ];
  
      values.forEach(value => {
        const td = document.createElement('td');
        td.textContent = value;
        row.appendChild(td);
      });
  
      // Register button logic
      const registerTd = document.createElement('td');
      const isStakeRegistered = await contract.methods.isStakeRegistered(stake.stakeId).call();
      const tierIndex = await contract.methods.determineTier(stake.stakedHearts).call();
      const tierStakesCount = await contract.methods.tierStakesCount(tierIndex).call();
      let registerButtonDisplayed = false; // Flag to track if register button is displayed

      if (!isStakeRegistered && stake.stakeId > await contract.methods.STAKEID_PROTECTION().call() && tierStakesCount < 100) {
        const registerButton = document.createElement('button');
        registerButton.textContent = 'Register';
        registerButton.addEventListener('click', async () => {
          await contract.methods.claimStake(i).send({ from: accounts[0] });
          await getStakeList();
        });
        registerTd.appendChild(registerButton);
        registerButtonDisplayed = true; // Set flag to true if button is added
      }
      row.appendChild(registerTd);
  
      // Claim button logic
      const claimTd = document.createElement('td');
      if (!registerButtonDisplayed && claimedReward.toString() === '0') {
        const claimButton = document.createElement('button');
        claimButton.textContent = 'Claim';
        claimButton.addEventListener('click', async () => {
          await claimReward(i);
        });
        claimTd.appendChild(claimButton);
      }
      row.appendChild(claimTd);
  
      // Return button logic
      const returnTd = document.createElement('td');
      if (!registerButtonDisplayed && claimedReward.toString() !== '0') {
        const returnButton = document.createElement('button');
        returnButton.textContent = 'Return + (30% burn fee)';
        returnButton.addEventListener('click', async () => {
          const claimedRewardNumber = Number(claimedReward.toString());
          const returnAmount = claimedRewardNumber * 1.3;
          await returnReward(i, returnAmount);
        });
        returnTd.appendChild(returnButton);
      }
      row.appendChild(returnTd);
  
      table.appendChild(row);
    }
  
    stakeListElement.appendChild(table);
}
  
  
  
async function addTokenToMetaMask() {
    try {
      const tokenAddress = contractAddress;
      const tokenSymbol = 'HXR';
      const tokenDecimals = 18;
      const tokenImage = './logo-nobackground-1000.png';
  
      const wasAdded = await ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: tokenAddress,
            symbol: tokenSymbol,
            decimals: tokenDecimals,
            image: tokenImage,
          },
        },
      });
  
      if (wasAdded) {
        console.log('Token added to MetaMask');
      } else {
        console.log('Token not added to MetaMask');
      }
    } catch (error) {
      console.error(error);
    }
  }  

document.getElementById('connectButton').addEventListener('click', connectToMetaMask);
document.getElementById('addTokenButton').addEventListener('click', addTokenToMetaMask);
