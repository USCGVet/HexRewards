const contractAddress = '0xcfcb89f00576a775d9f81961a37ba7dcf12c7d9b'; // Replace with your contract address
const MAX_STAKES_PER_TIER = 369;

let web3, contract, accounts, abi;
let claimedReward, earlyReward, finishedReward;

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
      //await getStakeList();
      //await displayRemainingSeats();

      // Store the connection status in localStorage
      localStorage.setItem('isMetaMaskConnected', 'true');
    } catch (error) {
      console.error(error);
    }
  } else {
    alert('Please install MetaMask to interact with this dApp!');
  }
}

async function checkAndConnectToMetaMask() {
  const isConnected = localStorage.getItem('isMetaMaskConnected');
  if (isConnected === 'true') {
    await connectToMetaMask();
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
async function getStakeList() {
    console.log('Calling getStakeList function...');
    try {
      //const stakeListSpinner = document.getElementById('stakeListSpinner');
      //stakeListSpinner.style.display = 'block';

      const theStakeList = await contract.methods.getStakeList(accounts[0]).call();
      console.log('Stake list retrieved:', theStakeList);
      //displayStakeList(theStakeList);

      //stakeListSpinner.style.display = 'none';
    } catch (error) {
      console.error('Error retrieving stake list:', error);
      alert('Failed to retrieve stake list. Please check the console for more information.');
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
async function queryStake() {
  const stakeIndexInput = document.getElementById('stakeIndexInput');
  const stakeIndex = parseInt(stakeIndexInput.value);

  if (isNaN(stakeIndex) || stakeIndex < 0) {
    alert('Please enter a valid stake index.');
    return;
  }

  try {
    const stakeList = await contract.methods.getStakeList(accounts[0]).call();
    if (stakeIndex >= stakeList.length) {
      alert('Invalid stake index. Please enter a valid index within the range of your stakes.');
      return;
    }

    const stake = stakeList[stakeIndex];
    const consumedDays = await contract.methods.calculateConsumedDays(stake.lockedDay, stake.stakedDays).call();

    
    try {
      claimedReward = await contract.methods.getClaimedReward(accounts[0], stakeIndex).call();
      earlyReward = await contract.methods.calculateReward(consumedDays, stake.stakedDays, stake.unlockedDay).call();
      finishedReward = await contract.methods.calculateReward(stake.stakedDays, stake.stakedDays, 1).call();
    } catch (error) {
      console.error('Error retrieving claimed reward:', error);
      claimedReward = '0';
      earlyReward = '0';
      finishedReward = '0';
    }

    const stakeInfo = `
      <table>
        <tr><th>Stake ID</th><td>${stake.stakeId}</td></tr>
        <tr><th>Staked Hearts</th><td>${stake.stakedHearts}</td></tr>
        <tr><th>Stake Shares</th><td>${stake.stakeShares}</td></tr>
        <tr><th>Locked Day</th><td>${stake.lockedDay}</td></tr>
        <tr><th>Staked Days</th><td>${stake.stakedDays}</td></tr>
        <tr><th>Unlocked Day</th><td>${stake.unlockedDay}</td></tr>
        <tr><th>Auto Stake</th><td>${stake.isAutoStake}</td></tr>
        <tr><th>Consumed Days</th><td>${consumedDays}</td></tr>
        <tr><th>Early Reward</th><td>${web3.utils.fromWei(earlyReward, 'ether')}</td></tr>
        <tr><th>Finished Reward</th><td>${web3.utils.fromWei(finishedReward, 'ether')}</td></tr>
        <tr><th>Claimed Reward</th><td>${web3.utils.fromWei(claimedReward, 'ether')}</td></tr>
      </table>
    `;

    document.getElementById('stakeInfo').innerHTML = stakeInfo;
    
      // Display the "Check Buttons" button
      const checkButtonsButton = `<button id="checkButtonsButton">Check Buttons</button>`;
      document.getElementById('stakeButtons').innerHTML = checkButtonsButton;
    
      // Add click event listener to the "Check Buttons" button
      document.getElementById('checkButtonsButton').addEventListener('click', async () => {
        await displayButtons(stake, stakeIndex);
      });
  } catch (error) {
    console.error('Error retrieving stake:', error);
    alert('Failed to retrieve stake. Please check the console for more information.');
  }
}


async function displayButtons(stake, stakeIndex) {
  let buttonsHTML = '';
   
  // Register button logic
  const isStakeRegistered = await contract.methods.isStakeRegistered(stake.stakeId).call();
  const tierIndex = await contract.methods.determineTier(stake.stakedHearts).call();
  const tierStakesCount = await contract.methods.tierStakesCount(tierIndex).call();

  if (!isStakeRegistered && stake.stakeId > await contract.methods.STAKEID_PROTECTION().call() && tierStakesCount < 369) {
    buttonsHTML += `<button id="registerButton">Register</button>`;
  }

  // Claim button logic
  claimedReward = await contract.methods.getClaimedReward(accounts[0], stakeIndex).call();
  if (claimedReward.toString() === '0') {
    buttonsHTML += `<button id="claimButton">Claim</button>`;
  }

  // Return button logic
  if (claimedReward.toString() !== '0') {
    buttonsHTML += `<button id="returnButton">Return + (30% burn fee)</button>`;
  }

  document.getElementById('stakeButtons').innerHTML = buttonsHTML;

  // Add click event listeners to the buttons
  const registerButton = document.getElementById('registerButton');
  if (registerButton) {
    registerButton.textContent = 'Register';
    registerButton.addEventListener('click', async () => {
      await contract.methods.claimStake(stakeIndex).send({ from: accounts[0] });
      await queryStake();
      
    });
  }

  const claimButton = document.getElementById('claimButton');
  if (claimButton) {
    claimButton.textContent = 'Claim';
    claimButton.addEventListener('click', async () => {
      await claimReward(stakeIndex);
      await queryStake();
    });
  }

  const returnButton = document.getElementById('returnButton');
  if (returnButton) {
    returnButton.textContent = 'Return + (30% burn fee)';
    returnButton.addEventListener('click', async () => {
      const returnAmount = await contract.methods.calculateReturnAmount(stakeIndex).call();
      await returnReward(stakeIndex, returnAmount);
      await queryStake();
    });
  }
}

async function claimReward(stakeIndex) {
    try {
      await contract.methods.claimReward(stakeIndex).send({ from: accounts[0] });
      alert('Reward claimed successfully!');
      await getTokenBalance(); // Refresh token balance in the header
      
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
          
      } else {
          alert('Insufficient balance to return the reward.');
      }
    } catch (error) {
      console.error(error);
      alert('Failed to return reward. Please check the console for more information.');
    }
}


document.getElementById('connectButton').addEventListener('click', connectToMetaMask);
document.getElementById('addTokenButton').addEventListener('click', addTokenToMetaMask);
document.getElementById('queryStakeButton').addEventListener('click', queryStake);

// Call the checkAndConnectToMetaMask function when the page loads
window.addEventListener('load', checkAndConnectToMetaMask);
