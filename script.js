// script.js

// Replace with your actual contract address:
const contractAddress = '0xCfCb89f00576A775d9f81961A37ba7DCf12C7d9B';
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
      document.getElementById('mainContent').style.display = 'block';
      document.getElementById('tokenBalanceHeader').style.display = 'block';
      document.getElementById('connectButton').style.display = 'none';
      document.getElementById('connectAddr').style.display = 'block';

      await getNetwork();
      await getTokenBalance();
      await getStakeList(); // <-- builds out your DataTable
      await displayRemainingSeats();

      localStorage.setItem('isMetaMaskConnected', 'true');
    } catch (error) {
      console.error(error);
    }
  } else {
    alert('Please install MetaMask to interact with this dApp!');
  }
}

async function getNetwork() {
  if (typeof window.ethereum !== 'undefined') {
    const ethereum = window.ethereum;
    ethereum
      .request({ method: 'net_version' })
      .then((networkId) => {
        let networkName;
        switch (networkId) {
          case '1': networkName = 'Mainnet'; break;
          case '3': networkName = 'Ropsten'; break;
          case '4': networkName = 'Rinkeby'; break;
          case '5': networkName = 'Goerli'; break;
          case '42': networkName = 'Kovan'; break;
          case '369': networkName = 'PulseChain Mainnet'; break;
          case '943': networkName = 'PulseChain Testnet v4'; break;
          default: networkName = 'Unknown';
        }
        document.getElementById('networkInfo').innerHTML = `Connected: ${networkName}`;
        console.log('Connected to ' + networkName);
      })
      .catch((error) => {
        console.error('Error fetching network ID:', error);
      });
  } else {
    console.error('MetaMask is not installed');
  }
}

async function getTokenBalance() {
  try {
    const tokenAddress = contractAddress;
    const tokenContract = new web3.eth.Contract(abi, tokenAddress);
    const balance = await tokenContract.methods.balanceOf(accounts[0]).call();
    const formattedBalance = parseFloat(web3.utils.fromWei(balance, 'ether')).toFixed(8);
    document.getElementById('tokenBalance').innerHTML = `Your HexReward Balance: ${formattedBalance}`;

    const totalSupply = await contract.methods.totalSupply().call();
    const formattedTotalSupply = parseFloat(web3.utils.fromWei(totalSupply, 'ether')).toFixed(8);
    document.getElementById('totalTokenSupply').innerHTML = `Total HexReward Supply: ${formattedTotalSupply}`;
  } catch (error) {
    console.error(error);
    alert('Failed to retrieve token balance. Please check the console for more information.');
  }
}

/** 
 * --------------------
 *    MAIN CHANGE:
 * --------------------
 * In getStakeList(), BigInt fields (like stakeId, lockedDay, etc.) are converted to string or number 
 * before pushing into dataSet. This prevents DataTables from throwing "Cannot convert a BigInt value to a number."
 */
async function getStakeList() {
  console.log('Calling getStakeList function...');
  // Show spinner
  document.getElementById('spinnerContent').style.display = 'block';
  document.getElementById('stakeListSpinner').style.display = 'block';

  try {
    const theStakeList = await contract.methods.getStakeList(accounts[0]).call();
    console.log('Stake list retrieved:', theStakeList);

    if (!Array.isArray(theStakeList) || theStakeList.length === 0) {
      // Hide spinner
      document.getElementById('spinnerContent').style.display = 'none';
      document.getElementById('stakeListSpinner').style.display = 'none';

      // Initialize an empty DataTable so it doesn't break
      $('#stakeList').DataTable({
        data: [],
        columns: [
          { title: 'No Stakes Found.' }
        ]
      });
      return;
    }

    // Example: We'll gather seat info or similar logic here
    const seatsArray = await getRemainingSeats(); 

    // Now gather row objects
    const dataSet = [];

    for (let i = 0; i < theStakeList.length; i++) {
      const stake = theStakeList[i];

      // Convert BigInt fields to strings/numbers for display
      const stakeIdString = stake.stakeId.toString();
      const stakedHeartsStr = formatBigIntWithDecimals(stake.stakedHearts, 8, 3);
      const stakeSharesStr  = formatBigIntWithDecimals(stake.stakeShares, 9, 3);
      const lockedDayInt    = Number(stake.lockedDay);
      const stakedDaysInt   = Number(stake.stakedDays);
      const unlockedDayInt  = Number(stake.unlockedDay);

      // Additional read-only calls
      const consumedDays  = await contract.methods
        .calculateConsumedDays(stake.lockedDay, stake.stakedDays)
        .call();

      const claimedReward = await safeCall(
        contract.methods.getClaimedReward(accounts[0], i).call(),
        '0'
      );
      const earlyReward   = await safeCall(
        contract.methods.calculateReward(consumedDays, stake.stakedDays, stake.unlockedDay).call(),
        '0'
      );
      const finishedReward = await safeCall(
        contract.methods.calculateReward(stake.stakedDays, stake.stakedDays, 1).call(),
        '0'
      );

      // Convert to decimal strings
      const earlyRewardNum    = parseFloat(web3.utils.fromWei(earlyReward, 'ether')).toFixed(8);
      const finishedRewardNum = parseFloat(web3.utils.fromWei(finishedReward, 'ether')).toFixed(8);
      const claimedRewardNum  = parseFloat(web3.utils.fromWei(claimedReward, 'ether')).toFixed(8);

      // Booleans
      const isClaimed    = Number(claimedReward) > 0;
      const isRegistered = await safeCall(
        contract.methods.isStakeRegistered?.(stake.stakeId).call(),
        false
      );

      // Tier logic
      const stakedHeartsBigInt = BigInt(stake.stakedHearts);
      const stakeTier          = calculateTierFromHearts(stakedHeartsBigInt);
      const seatsAvailable     = seatsArray[stakeTier] > 0;
      
      // Push to dataSet
      dataSet.push({
        index: i,
        stakeId: stakeIdString,
        stakedHearts: stakedHeartsStr,
        stakeShares: stakeSharesStr,
        lockedDay: lockedDayInt,
        stakedDays: stakedDaysInt,
        unlockedDay: unlockedDayInt,
        consumedDays: Number(consumedDays),
        earlyReward: earlyRewardNum,
        finishedReward: finishedRewardNum,
        claimedReward: claimedRewardNum,  // stays here for display in the Claim column
        isClaimed,
        isRegistered,
        seatsAvailable,
        stakeTier,
      });
    }

    // Hide spinner
    document.getElementById('stakeListSpinner').style.display = 'none';
    document.getElementById('spinnerContent').style.display = 'none';

    // (Re)Initialize DataTable
    if ($.fn.DataTable.isDataTable('#stakeList')) {
      $('#stakeList').DataTable().destroy();
    }
    $('#stakeList').empty(); // Clear out old table header/footer

    $('#stakeList').DataTable({
      data: dataSet,
      columns: [
        { data: 'index',          title: 'Stake Index' },
        { data: 'stakeId',        title: 'Stake ID' },
        { data: 'stakedHearts',   title: 'Staked Hex' },
        { data: 'stakeShares',    title: 'Stake B-Shares' },
        { data: 'lockedDay',      title: 'Locked Day' },
        { data: 'stakedDays',     title: 'Staked Days' },
        { data: 'consumedDays',   title: 'Consumed Days' },
        { data: 'earlyReward',    title: 'Early Reward' },
        { data: 'finishedReward', title: 'Finished Reward' },
        // Removed the separate "Claimed Reward" column
        {
          title: 'Register',
          data: null,
          render: function(data, type, row) {
            const heartsNum  = parseFloat(row.stakedHearts);
            const stakeIdNum = parseFloat(row.stakeId);

            if (heartsNum < 1000) {
              return 'Not Allowed';
            } else if (stakeIdNum < 817340) {
              return 'Not Needed';
            } else if (row.isRegistered) {
              return 'Registered';
            } else if (!row.seatsAvailable) {
              return 'No Seats Left';
            } else {
              return `<button class="register-btn" data-stake-index="${row.index}">Register</button>`;
            }
          },
        },
        {
          title: 'Claim',
          data: null,
          render: function(data, type, row) {
            const heartsNum  = parseFloat(row.stakedHearts);
            const stakeIdNum = parseFloat(row.stakeId);

            if (heartsNum < 1000) {
              return 'Not Allowed';
            } else if (row.isClaimed) {
              // Display the claimed amount here
              return `Claimed<br/><span class="small-amount">${row.claimedReward}</span>`;
            } else if (stakeIdNum < 817340) {
              // For older stake IDs
              return `<button class="claim-btn" data-stake-index="${row.index}">Claim</button>`;
            } else {
              // Must be registered first
              return row.isRegistered
                ? `<button class="claim-btn" data-stake-index="${row.index}">Claim</button>`
                : 'Not Registered';
            }
          }
        },
        {
          title: 'Return',
          data: null,
          render: function(data, type, row) {
            if (!row.isClaimed) {
              return 'Not Claimed';
            }
            try {
              const earlyRewardWei     = web3.utils.toWei(row.earlyReward, 'ether');
              const requiredReturnWei  = (BigInt(earlyRewardWei) * 130n) / 100n;
              const requiredReturnHXR  = parseFloat(
                web3.utils.fromWei(requiredReturnWei.toString(), 'ether')
              ).toFixed(4);

              return `
                <div class="return-cell">
                  <button 
                    class="return-btn" 
                    data-stake-index="${row.index}" 
                    data-early-reward="${row.earlyReward}"
                  >
                    Return
                  </button>
                  <div class="small-amount">
                    Needs ~${requiredReturnHXR} HXR
                  </div>
                </div>
              `;
            } catch (err) {
              console.error('Error calculating Return HXR:', err);
              return `
                <button class="return-btn" data-stake-index="${row.index}" data-early-reward="${row.earlyReward}">
                  Return
                </button>
              `;
            }
          }
        },
        {
          title: 'Good Accounting',
          data: null,
          render: function(data, type, row) {
            if (row.unlockedDay && row.unlockedDay > 0) {
              return 'GA Done';
            } else {
              return `
                <button
                  class="ga-btn"
                  data-stake-index="${row.index}"
                  data-stake-id="${row.stakeId}"
                >
                  GA
                </button>
              `;
            }
          }
        },
        {
          title: 'End Stake',
          data: null,
          render: function(data, type, row) {
            return `
              <button
                class="end-btn"
                data-stake-index="${row.index}"
                data-stake-id="${row.stakeId}"
              >
                End
              </button>
            `;
          }
        },
      ],
      pageLength: 10,
      responsive: true
    });

    // Wire up the button clicks (delegate events)
    wireUpTableButtons();

  } catch (error) {
    console.error('Error retrieving stake list:', error);
    alert('Failed to retrieve stake list. Please check the console for more info.');
    // Hide spinner
    document.getElementById('stakeListSpinner').style.display = 'none';
    document.getElementById('spinnerContent').style.display = 'none';
  }
}


function wireUpTableButtons() {
  // The table's ID is stakeList
  const table = $('#stakeList');

  // Register
  table.off('click', '.register-btn').on('click', '.register-btn', async function () {
    const stakeIndex = $(this).data('stakeIndex');
    try {
      await contract.methods.claimStake(stakeIndex).send({ from: accounts[0] });
      alert('Stake successfully registered!');
      await getStakeList(); // Refresh the table
      await displayRemainingSeats();
    } catch (err) {
      console.error('Error registering stake:', err);
      alert('Registration failed. Check console for details.');
    }
  });

  // Claim
  table.off('click', '.claim-btn').on('click', '.claim-btn', async function () {
    const stakeIndex = $(this).data('stakeIndex');
    try {
      await contract.methods.claimReward(stakeIndex).send({ from: accounts[0] });
      alert('Reward claimed successfully!');
      await getTokenBalance();
      await getStakeList();
    } catch (err) {
      console.error(err);
      alert('Failed to claim reward. Check console for more information.');
    }
  });

  // Return
  table.off('click', '.return-btn').on('click', '.return-btn', async function () {
    const stakeIndex = $(this).data('stakeIndex');
    const rawEarlyReward = $(this).data('earlyReward'); // from the row
    try {
      const earlyRewardWei = web3.utils.toWei(rawEarlyReward, 'ether');
      const returnAmountWei = (BigInt(earlyRewardWei) * BigInt(130n)) / BigInt(100n);
      const returnAmount = returnAmountWei.toString();

      const currentBalance = await contract.methods.balanceOf(accounts[0]).call();
      if (BigInt(currentBalance) >= BigInt(returnAmount)) {
        await contract.methods.returnReward(stakeIndex, returnAmount).send({ from: accounts[0] });
        alert('Reward returned successfully!');
        await getTokenBalance();
        await getStakeList();
      } else {
        alert('Insufficient balance to return the reward.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to return reward. Check console for more info.');
    }
  });

  // Good Accounting (GA)
  table.off('click', '.ga-btn').on('click', '.ga-btn', async function () {
    const stakeIndex = $(this).data('stakeIndex');
    const stakeId = $(this).data('stakeId');
    try {
      const hexContractAddress = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
      const hexAbi = await loadHexABI();
      if (!hexAbi) throw new Error('Failed to load Hex ABI.');
      const hexContract = new web3.eth.Contract(hexAbi, hexContractAddress);

      await hexContract.methods.stakeGoodAccounting(accounts[0], stakeIndex, stakeId).send({
        from: accounts[0],
      });
      alert('Good Accounting called successfully!');
      await getStakeList();
    } catch (error) {
      console.error(error);
      alert('Failed to call Good Accounting. Check console for info.');
    }
  });

  // End Stake
  table.off('click', '.end-btn').on('click', '.end-btn', async function () {
    const stakeIndex = $(this).data('stakeIndex');
    const stakeId = $(this).data('stakeId');
    try {
      const hexContractAddress = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
      const hexAbi = await loadHexABI();
      if (!hexAbi) {
        alert('Failed to load Hex ABI');
        return;
      }
      const hexContract = new web3.eth.Contract(hexAbi, hexContractAddress);

      await hexContract.methods.stakeEnd(stakeIndex, stakeId).send({ from: accounts[0] });
      alert('Stake ended successfully!');
      await getStakeList();
    } catch (error) {
      console.error(error);
      alert('Error ending stake. Check console for details.');
    }
  });
}
/**
 * Calculates which tier a stake belongs to based on its size in hearts.
 * Does *not* rely on contract logic; it’s purely front-end JavaScript.
 *
 * @param {BigInt} amountInHearts - The stake size in hearts as a BigInt.
 * @returns {number} Tier index from 0..8, or 9 if invalid (below 1,000).
 */
function calculateTierFromHearts(amountInHearts) {
  // Adjust these thresholds to match your actual tier logic:

  // For example, if 1,000 hearts is the minimum to even qualify (Tier 0):
  if (amountInHearts < 1_000n) {
    return 9; // “Invalid” or “Not in any tier”
  } else if (amountInHearts < 10_000n) {
    return 0; 
  } else if (amountInHearts < 100_000n) {
    return 1;
  } else if (amountInHearts < 1_000_000n) {
    return 2;
  } else if (amountInHearts < 10_000_000n) {
    return 3;
  } else if (amountInHearts < 100_000_000n) {
    return 4;
  } else if (amountInHearts < 1_000_000_000n) {
    return 5;
  } else if (amountInHearts < 10_000_000_000n) {
    return 6;
  } else if (amountInHearts < 100_000_000_000n) {
    return 7;
  } else {
    return 8;
  }
}


// Utility: safer call that returns a default if something fails
async function safeCall(promise, defaultValue) {
  try {
    return await promise;
  } catch (err) {
    console.error(err);
    return defaultValue;
  }
}

// Register stake
async function registerStake(index, stakeId) {
  try {
    // Example check: must not be registered, must be in valid tier, etc.
    await contract.methods.claimStake(index).send({ from: accounts[0] });
    alert('Stake successfully registered!');
    await getStakeList();
    await displayRemainingSeats();
  } catch (error) {
    console.error('Error registering stake:', error);
    alert('Registration failed. Check console for details.');
  }
}

async function claimReward(stakeIndex) {
  try {
    await contract.methods.claimReward(stakeIndex).send({ from: accounts[0] });
    alert('Reward claimed successfully!');
    await getTokenBalance();
    await getStakeList();
  } catch (error) {
    console.error(error);
    alert('Failed to claim reward. Check console for more information.');
  }
}

// Return Reward logic
async function returnHXR(stakeIndex, rawEarlyReward) {
  try {
    // For example, parse it from the string you stored in the row
    const earlyRewardWei = web3.utils.toWei(rawEarlyReward, 'ether');
    // Multiply by 1.3 to get final
    const returnAmountWei = (BigInt(earlyRewardWei) * BigInt(130n)) / BigInt(100n);
    const returnAmount = returnAmountWei.toString();

    const currentBalance = await contract.methods.balanceOf(accounts[0]).call();
    if (BigInt(currentBalance) >= BigInt(returnAmount)) {
      await contract.methods.returnReward(stakeIndex, returnAmount).send({ from: accounts[0] });
      alert('Reward returned successfully!');
      await getTokenBalance();
      await getStakeList();
    } else {
      alert('Insufficient balance to return the reward.');
    }
  } catch (error) {
    console.error(error);
    alert('Failed to return reward. Check console for more info.');
  }
}

async function endStake(stakeIndex, stakeId) {
  try {
    const hexContractAddress = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
    const hexAbi = await loadHexABI();
    if (!hexAbi) {
      alert('Failed to load Hex ABI');
      return;
    }
    const hexContract = new web3.eth.Contract(hexAbi, hexContractAddress);

    await hexContract.methods.stakeEnd(stakeIndex, stakeId).send({ from: accounts[0] });
    alert('Stake ended successfully!');
    await getStakeList();
  } catch (error) {
    console.error(error);
    alert('Error ending stake. Check console for details.');
  }
}

async function callGoodAccounting(stakeId, stakeIndex) {
  try {
    const hexContractAddress = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
    const hexAbi = await loadHexABI();
    if (!hexAbi) throw new Error('Failed to load Hex ABI.');
    const hexContract = new web3.eth.Contract(hexAbi, hexContractAddress);

    await hexContract.methods.stakeGoodAccounting(accounts[0], stakeIndex, stakeId).send({
      from: accounts[0],
    });
    alert('Good Accounting called successfully!');
    await getStakeList();
  } catch (error) {
    console.error(error);
    alert('Failed to call Good Accounting. Check console for info.');
  }
}

// Optional utility function for formatting
function formatBigIntWithDecimals(bigInt, divisor, decimalPlaces) {
  const bigIntString = bigInt.toString();
  const length = bigIntString.length;
  // e.g. for hearts: divisor=8 => move decimal 8 places
  const integerPart = bigIntString.slice(0, Math.max(0, length - divisor)) || '0';
  const fractionalPart = bigIntString.slice(Math.max(0, length - divisor));
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

// Tiers
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

  // Example plain table for tier info
  const tbl = document.createElement('table');
  tbl.classList.add('tier-info');

  const headerRow = document.createElement('tr');
  const headers = ['Tier', 'Hex Stake Size Range', 'Hex Stakes (Seats) Left to Register'];
  headers.forEach((header) => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  tbl.appendChild(headerRow);

  for (let i = 0; i < 9; i++) {
    const tr = document.createElement('tr');
    const tierTd = document.createElement('td');
    tierTd.textContent = `Tier ${i}`;
    const rangeTd = document.createElement('td');
    rangeTd.textContent = tierRanges[i];
    const seatTd = document.createElement('td');
    seatTd.textContent = remainingSeats[i];

    tr.appendChild(tierTd);
    tr.appendChild(rangeTd);
    tr.appendChild(seatTd);
    tbl.appendChild(tr);
  }
  tierListElement.appendChild(tbl);
}

// Toggle video container logic
const videoContainer = document.getElementById('videoContainer');
const toggleVideoBtn = document.getElementById('toggleVideoBtn');

function toggleVideoVisibility() {
  videoContainer.classList.toggle('hidden');
  if (!videoContainer.classList.contains('hidden')) {
    // Reload Twitter widget if needed
    if (typeof twttr !== 'undefined' && twttr.widgets) {
      twttr.widgets.load();
    }
  }
}

toggleVideoBtn.addEventListener('click', toggleVideoVisibility);

// Add token to MetaMask
async function addTokenToMetaMask() {
  try {
    const tokenSymbol = 'HXR';
    const tokenDecimals = 18;
    const tokenImage = './logo-nobackground-1000.png';    

    const wasAdded = await ethereum.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          address: contractAddress,
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

// Bind click events
document.getElementById('connectButton').addEventListener('click', connectToMetaMask);
document.getElementById('addTokenButton').addEventListener('click', addTokenToMetaMask);
document.getElementById('addHexTokenButton').addEventListener('click', addHexTokenToMetaMask);
