
// Terminal CD frontend
// Terminal http-server

const contractAddress = '0xCfCb89f00576A775d9f81961A37ba7DCf12C7d9B'; // Replace with your contract address  DEV Address:0x8Aed6FE10dF3d6d981B101496C9c7245AE65cAEc  // Real HexRewards:0xCfCb89f00576A775d9f81961A37ba7DCf12C7d9B
const MAX_STAKES_PER_TIER = 369;

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
      await displayRemainingSeats();

      // Store the connection status in localStorage
      localStorage.setItem('isMetaMaskConnected', 'true');
    } catch (error) {
      console.error(error);
    }
  } else {
    alert('Please install MetaMask to interact with this dApp!');
  }
}

/*
async function checkAndConnectToMetaMask() {
  const isConnected = localStorage.getItem('isMetaMaskConnected');
  if (isConnected === 'true') {
    await connectToMetaMask();
  }
}
*/
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

async function getRemainingSeats() {
    try {
        const remainingSeats = [];
        for (let i = 0; i < 9; i++) {
            const tierCount = await contract.methods.tierStakesCount(i).call();
            remainingSeats.push(MAX_STAKES_PER_TIER - Number(tierCount));
        }
        return remainingSeats;
    } catch (error) {
        console.error('Failed to fetch remaining seats:', error);
        return [];
    }
}

async function getStakeList() {
  console.log('Calling getStakeList function...');
  try {
      const theStakeList = await contract.methods.getStakeList(accounts[0]).call();
      console.log('Stake list retrieved:', theStakeList);
      
      if (!Array.isArray(theStakeList)) {
          console.error('getStakeList did not return an array:', theStakeList);
          displayStakeList([]);  // Pass an empty array if the result is not as expected
      } else {
          displayStakeList(theStakeList);
      }
  } catch (error) {
      console.error('Error retrieving stake list:', error);
      alert('Failed to retrieve stake list. Please check the console for more information.');
      displayStakeList([]);  // Pass an empty array in case of error
  }
}

async function displayRemainingSeats() {
    const tierListElement = document.getElementById('tierList');
    tierListElement.innerHTML = '';

    const remainingSeats = await getRemainingSeats();
    const tierRanges = [
        '1,000 - 9,999',
        '10,000 - 99,999',
        '100,000 - 999,999',
        '1,000,000 - 9,999,999',
        '10,000,000 - 99,999,999',
        '100,000,000 - 999,999,999',
        '1,000,000,000 - 9,999,999,999',
        '10,000,000,000 - 99,999,999,999',
        '100,000,000,000+'
    ];

    const remainingSeatsElement = document.createElement('table');
    remainingSeatsElement.classList.add('tier-info');
    const headerRow = document.createElement('tr');
    const headers = ['Tier', 'Hex Stake Size Range', 'Hex Stakes (Seats) Left to Register'];
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    remainingSeatsElement.appendChild(headerRow);

    for (let i = 0; i < 9; i++) {
        const tierRow = document.createElement('tr');
        const tierCell = document.createElement('td');
        tierCell.textContent = `Tier ${i}`;
        const rangeCell = document.createElement('td');
        rangeCell.textContent = tierRanges[i];
        const seatsCell = document.createElement('td');
        seatsCell.textContent = remainingSeats[i];

        tierRow.appendChild(tierCell);
        tierRow.appendChild(rangeCell);
        tierRow.appendChild(seatsCell);
        remainingSeatsElement.appendChild(tierRow);
    }

    tierListElement.appendChild(remainingSeatsElement);
}

async function displayStakeList(stakeList) {
  const stakeListElement = document.getElementById('stakeList');
  stakeListElement.innerHTML = '';

  // Check if stakeList is undefined or null
  if (!stakeList || stakeList.length === 0) {
    stakeListElement.innerHTML = '<p>No stakes found.</p>';
    return;
  }

  const stakesPerPage = 20;
  const totalPages = Math.ceil(stakeList.length / stakesPerPage);

  let currentPage = 1;

  // Load HEX ABI and create contract instance
  const hexContractAddress = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
  const hexAbi = await loadHexABI();
  if (!hexAbi) {
    console.error('Failed to load Hex ABI.');
    return;
  }
  const hexContract = new web3.eth.Contract(hexAbi, hexContractAddress);

  
  async function updateGlobalIndex(hexContract, stakeId, actionFunction) {
    try {
      // Get the total number of stakes for the user
      const stakeCount = await hexContract.methods.stakeCount(accounts[0]).call();
      
      // Iterate through the stakes to find the matching stakeId
      let stakeIndex = -1;
      for (let i = 0; i < stakeCount; i++) {
        const stake = await hexContract.methods.stakeLists(accounts[0], i).call();
        if (stake.stakeId === stakeId) {
          stakeIndex = i;
          break;
        }
      }
  
      if (stakeIndex === -1) {
        throw new Error("Stake not found");
      }
  
      await actionFunction(stakeIndex);
      
      // Refresh the displayed list after successful action
      const updatedStakeList = await getStakeList();
      displayStakeList(updatedStakeList);
    } catch (error) {
      console.error(error);
      if (error.message === "Stake not found") {
        alert("This stake is no longer available. The page will now refresh.");
        location.reload();
      } else {
        alert("An error occurred. Please try refreshing the page.");
      }
    }
  }


  async function showPage(page) {
    currentPage = page;
    const startIndex = (page - 1) * stakesPerPage;
    const endIndex = startIndex + stakesPerPage;
    const stakesToShow = stakeList.slice(startIndex, endIndex);

    // Clear the stake list element
    stakeListElement.innerHTML = '';

    // Create and show the spinner
    const spinnerContent = document.getElementById('spinnerContent');
    spinnerContent.style.display = 'block';
    const stakeListSpinner = document.getElementById('stakeListSpinner');
    stakeListSpinner.style.display = 'block';

    const table = document.createElement('table');
    const headerRow = document.createElement('tr');
    const headers = ['Stake Index', 'Stake ID', 'Staked Hex', 'Stake B-Shares', 'Locked Day', 'Staked Days', 'Consumed Days', 'Early Reward', 'Finished Reward', 'Claimed Reward', 'Register', 'Claim Reward', 'Good Accounting (for 10x Bonus)', 'Return Reward', 'End Stake'];

    headers.forEach(header => {
      const th = document.createElement('th');
      th.textContent = header;
      headerRow.appendChild(th);
    });

    table.appendChild(headerRow);

    // Load HEX ABI and create contract instance
    const hexContractAddress = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
    const hexAbi = await loadHexABI();
    if (!hexAbi) {
      console.error('Failed to load Hex ABI.');
      return;
    }
    const hexContract = new web3.eth.Contract(hexAbi, hexContractAddress);

    const mismatches = [];

    const rowPromises = stakesToShow.map(async (stake, index) => {
      const globalIndex = parseInt(startIndex + index); // Pre-calculate the index

      // Verification step
      try {
        const hexStake = await hexContract.methods.stakeLists(accounts[0], globalIndex).call();
        if (stake.stakeId !== hexStake.stakeId) {
          mismatches.push({
            localStakeId: stake.stakeId,
            hexStakeId: hexStake.stakeId,
            globalIndex: globalIndex
          });
          console.error(`Mismatch at index ${globalIndex}: Local stakeId ${stake.stakeId} does not match HEX contract stakeId ${hexStake.stakeId}`);      
          return null; // Skip this stake if there's a mismatch
        }
      } catch (error) {
        console.error(`Error verifying stake at index ${globalIndex}:`, error);
        return null; // Skip this stake if there's an error
      }

      const consumedDays = await contract.methods.calculateConsumedDays(stake.lockedDay, stake.stakedDays).call();

      let claimedReward, earlyReward, finishedReward, returnAmt;
      
      try {
        claimedReward = await contract.methods.getClaimedReward(accounts[0], globalIndex).call();
      } catch (error) {
        console.error('Error retrieving claimed reward:', error);
        claimedReward = '0';
      }
      
      try {
        earlyReward = await contract.methods.calculateReward(consumedDays, stake.stakedDays, stake.unlockedDay).call();
      } catch (error) {
        console.error('Error retrieving early reward:', error);
        earlyReward = '0';
      }
      
      try {
        finishedReward = await contract.methods.calculateReward(stake.stakedDays, stake.stakedDays, 1).call();
      } catch (error) {
        console.error('Error retrieving finished reward:', error);
        finishedReward = '0';
      }
      
      // Convert earlyReward to Wei
      const earlyRewardWei = web3.utils.toWei(earlyReward, 'ether');

      // Convert earlyRewardWei to a BigInt
      const earlyRewardBigInt = BigInt(earlyRewardWei);

      // Multiply earlyReward by 1.30 and convert it to a BigInt
      const returnAmountWei = (earlyRewardBigInt * BigInt(130)) / BigInt(100);

      // Convert returnAmountWei to Ether
      returnAmt = web3.utils.fromWei(returnAmountWei.toString(), 'ether');

      const row = document.createElement('tr');
      const values = [
        globalIndex,
        stake.stakeId,
        formatBigIntWithDecimals(stake.stakedHearts, 8, 3),
        formatBigIntWithDecimals(stake.stakeShares, 9, 3),
        stake.lockedDay,
        stake.stakedDays,
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
      let tierStakesCount = 0n;
      if (tierIndex < 9n){
        tierStakesCount = await contract.methods.tierStakesCount(tierIndex).call();
      } 
      let registerButtonDisplayed = false;

      if (!isStakeRegistered && stake.stakeId > await contract.methods.STAKEID_PROTECTION().call() && tierStakesCount < 369 && tierIndex < 9n) {
        const registerButton = document.createElement('button');
        registerButton.textContent = 'Register';
        registerButton.addEventListener('click', () => updateGlobalIndex(hexContract, stake.stakeId, async (updatedIndex) => {
          await contract.methods.claimStake(updatedIndex).send({ from: accounts[0] });
          await getStakeList();
          await displayRemainingSeats();
        }));
        registerTd.appendChild(registerButton);
        registerButtonDisplayed = true;
      }
      row.appendChild(registerTd);

      // Claim button logic
      const claimTd = document.createElement('td');
      if (!registerButtonDisplayed && claimedReward.toString() === '0' && ((stake.stakeId >= 817340 && tierIndex < 9n) || (stake.stakeId < 817340))) {
        const claimButton = document.createElement('button');
        claimButton.textContent = 'Claim';
        claimButton.addEventListener('click', () => updateGlobalIndex(hexContract, stake.stakeId, async (updatedIndex) => {
          await claimReward(updatedIndex);
        }));
        claimTd.appendChild(claimButton);
      }
      row.appendChild(claimTd);

      // Good Accounting button logic
      const goodAccountingTd = document.createElement('td');
      if (!registerButtonDisplayed && BigInt(claimedReward) == 0n && stake.unlockedDay == 0n && consumedDays >= stake.stakedDays) {
        const goodAccountingButton = document.createElement('button');
        goodAccountingButton.textContent = 'Good Accounting';
        goodAccountingButton.addEventListener('click', () => updateGlobalIndex(hexContract, stake.stakeId, async (updatedIndex) => {
          await callGoodAccounting(stake.stakeId, updatedIndex);
        }));
        goodAccountingTd.appendChild(goodAccountingButton);
      }
      row.appendChild(goodAccountingTd);

      // Return button logic
      const returnTd = document.createElement('td');
      if (!registerButtonDisplayed && claimedReward.toString() !== '0') {
        const returnButton = document.createElement('button');

        // Calculate the return amount based on stake days consumed and stake length
        const stakeLength = Number(stake.stakedDays);
        const returnRate = stakeLength === 5555 ? 0.0001 : 0.00001;
        const returnAmount = (Number(consumedDays) * returnRate * 1.3).toFixed(8);

        returnButton.textContent = `Return HXR fee: ${returnAmount}`;

        returnButton.addEventListener('click', () => updateGlobalIndex(hexContract, stake.stakeId, async (updatedIndex) => {
          await returnReward(updatedIndex, returnAmt);
        }));

        returnTd.appendChild(returnButton);
      }
      row.appendChild(returnTd);

      // End Stake button logic
      const endStakeTd = document.createElement('td');
      const endStakeButton = document.createElement('button');
      endStakeButton.textContent = 'End Stake';
      endStakeButton.addEventListener('click', () => updateGlobalIndex(hexContract, stake.stakeId, async (updatedIndex) => {
        await hexContract.methods.stakeEnd(updatedIndex, stake.stakeId).send({ from: accounts[0] });
        alert('Stake ended successfully!');
        await getStakeList(); // Refresh the stake list
      }));
      endStakeTd.appendChild(endStakeButton);
      row.appendChild(endStakeTd);

      return row;
    });

    const rows = await Promise.all(rowPromises);
    rows.filter(row => row !== null).forEach(row => table.appendChild(row));

    if (mismatches.length > 0) {
      console.error('Mismatches found between local stake data and HEX contract data:', mismatches);
      const mismatchAlert = document.createElement('div');
      mismatchAlert.className = 'alert alert-warning';
      mismatchAlert.textContent = `Warning: ${mismatches.length} stake(s) were skipped due to data mismatches. Check console for details.`;
      stakeListElement.insertBefore(mismatchAlert, table);
    }

    stakeListElement.appendChild(table);

    // Create pagination buttons
    const paginationElement = document.createElement('div');
    paginationElement.classList.add('pagination');

    for (let i = 1; i <= totalPages; i++) {
      const button = document.createElement('button');
      button.textContent = i;
      button.addEventListener('click', () => showPage(i));
      if (i === currentPage) {
        button.classList.add('active');
      }
      paginationElement.appendChild(button);
    }

    stakeListElement.appendChild(paginationElement);

    // Remove the spinner after the table is fully populated
    stakeListSpinner.style.display = 'none';
    spinnerContent.style.display = 'none';
  }

  showPage(currentPage);
}


function formatBigIntWithDecimals(bigInt, divisor, decimalPlaces) {
  const bigIntString = bigInt.toString();
  const length = bigIntString.length;
  const integerPart = bigIntString.slice(0, length - divisor);
  const fractionalPart = bigIntString.slice(length - divisor);
  const formattedString = `${integerPart}.${fractionalPart.slice(0, decimalPlaces)}`;
  return parseFloat(formattedString).toFixed(decimalPlaces);
}

async function loadHexABI() {
  try {
    const response = await fetch('./HexABI.json');
    const hexAbi = await response.json();
    return hexAbi;
  } catch (error) {
    console.error('Error loading Hex ABI:', error);
    return null;
  }
}

async function callGoodAccounting(stakeId, stakeIndex) {
  try {
    const hexContractAddress = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
    const hexAbi = await loadHexABI();
    if (!hexAbi) {
      throw new Error('Failed to load Hex ABI.');
    }
    const hexContract = new web3.eth.Contract(hexAbi, hexContractAddress);

    await hexContract.methods.stakeGoodAccounting(accounts[0], stakeIndex, stakeId).send({ from: accounts[0] });
    alert('Good Accounting called successfully!');
    await getStakeList();
  } catch (error) {
    console.error(error);
    alert('Failed to call Good Accounting. Please check the console for more information.');
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


async function addHexTokenToMetaMask() {
  try {
    const tokenAddress = '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39';
    const tokenSymbol = 'HEX';
    const tokenDecimals = 8;
    const tokenImage = './HEXagon.png';

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


// Get the video container and toggle button elements
const videoContainer = document.getElementById('videoContainer');
const toggleVideoBtn = document.getElementById('toggleVideoBtn');

// Function to toggle the visibility of the video container
function toggleVideoVisibility() {
  videoContainer.classList.toggle('hidden');
  
  // Check if the container is visible and reload the Twitter widget
  if (!videoContainer.classList.contains('hidden')) {
    twttr.widgets.load();
  }
}

// Add a click event listener to the toggle button
toggleVideoBtn.addEventListener('click', toggleVideoVisibility);

document.getElementById('connectButton').addEventListener('click', connectToMetaMask);
document.getElementById('addTokenButton').addEventListener('click', addTokenToMetaMask);
document.getElementById('addHexTokenButton').addEventListener('click', addHexTokenToMetaMask);

// Call the checkAndConnectToMetaMask function when the page loads
//window.addEventListener('load', checkAndConnectToMetaMask);
