import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import './App.css';
import { contractABI, contractAddress } from './contracts.js';

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [properties, setProperties] = useState([]);
  const [buyDetails, setBuyDetails] = useState({
    propertyId: '',
    newOwnerName: '',
    newGovUID: '',
    newMetaMaskAccount: '',
    amount: ''
  });
  const [splitDetails, setSplitDetails] = useState({
    propertyId: '',
    splitPercentage: ''
  });
  const [sellableDetails, setSellableDetails] = useState({
    propertyId: '',
    isSellable: false,
    newSalePrice: ''
  });
  const [registerDetails, setRegisterDetails] = useState({
    ownerName: '',
    govUID: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    country: '',
    pinCode: '',
    cost: '',
    metaMaskAccount: '',
    salePrice: ''
  });
  const [updateAdminDetails, setUpdateAdminDetails] = useState({
    newAdmin1: '',
    newAdmin2: ''
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState(null);
  const [admin1, setAdmin1] = useState(null);
  const [admin2, setAdmin2] = useState(null);
  const [salePriceCheck, setSalePriceCheck] = useState({ propertyId: '', price: null });

  // Connect to MetaMask
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contractInstance = new ethers.Contract(contractAddress, contractABI, signer);
        setContract(contractInstance);
        const admin1Address = await contractInstance.admin1();
        const admin2Address = await contractInstance.admin2();
        setAdmin1(admin1Address);
        setAdmin2(admin2Address);
        setIsAdmin(
          accounts[0].toLowerCase() === admin1Address.toLowerCase() ||
          accounts[0].toLowerCase() === admin2Address.toLowerCase()
        );
      } catch (error) {
        console.error("Error connecting to MetaMask:", error);
        setError("Failed to connect to MetaMask: " + error.message);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  // Fetch all properties
  const fetchProperties = useCallback(async () => {
    if (contract) {
      try {
        const propertyCount = Number(await contract.propertyCount());
        const propertyList = [];
        for (let i = 0; i < propertyCount; i++) {
          const property = await contract.getProperty(i);
          propertyList.push({
            id: i,
            ownerName: property.ownerName,
            govUID: property.govUID,
            addressLine1: property.addressLine1,
            addressLine2: property.addressLine2,
            city: property.city,
            state: property.state,
            country: property.country,
            pinCode: property.pinCode,
            cost: property.cost, // Raw wei-like units
            metaMaskAccount: property.metaMaskAccount,
            isSellable: property.isSellable,
            salePrice: property.salePrice // Raw wei-like units
          });
        }
        setProperties(propertyList);
        setError(null);
      } catch (error) {
        console.error("Error fetching properties:", error);
        setError("Failed to fetch properties: " + error.message);
      }
    }
  }, [contract]);

  // Register property (admin only)
  const registerProperty = useCallback(async () => {
    if (contract && isAdmin) {
      try {
        const cost = registerDetails.cost; // Raw wei-like units
        const salePrice = registerDetails.salePrice; // Raw wei-like units
        console.log("Cost (wei-like):", cost);
        console.log("Sale Price (wei-like):", salePrice);
        const tx = await contract.registerProperty(
          registerDetails.ownerName,
          registerDetails.govUID,
          registerDetails.addressLine1,
          registerDetails.addressLine2,
          registerDetails.city,
          registerDetails.state,
          registerDetails.country,
          registerDetails.pinCode,
          cost,
          registerDetails.metaMaskAccount,
          salePrice
        );
        await tx.wait();
        alert("Property registered successfully!");
        fetchProperties();
      } catch (error) {
        console.error("Error registering property:", error);
        alert("Failed to register property: " + error.message);
      }
    }
  }, [contract, isAdmin, registerDetails, fetchProperties]);

  // Buy property
  const buyProperty = useCallback(async () => {
    if (contract) {
      try {
        // Check if property is sellable using fetched properties
        const property = properties.find(p => Number(p.id) === Number(buyDetails.propertyId));
        if (!property) {
          alert("Property does not exist.");
          return;
        }
        if (!property.isSellable) {
          alert("Property is not for sale.");
          return;
        }

        const storedProperty = await contract.getProperty(buyDetails.propertyId);
        console.log("Stored Sale Price (wei-like):", storedProperty.salePrice.toString());
        const amount = ethers.parseUnits(buyDetails.amount, 18); // Raw wei-like units
        console.log("Amount Sent (wei-like):", amount);

        const tx = await contract.buyProperty(
          buyDetails.propertyId,
          buyDetails.newOwnerName,
          buyDetails.newGovUID,
          buyDetails.newMetaMaskAccount,
          { value: amount.toString(), gasLimit: 100000 }
        );
        await tx.wait();
        alert("Property purchased successfully!");
        fetchProperties();
      } catch (error) {
        console.error("Error buying property:", error);
        alert("Failed to buy property: " + error.message);
      }
    }
  }, [contract, buyDetails, properties, fetchProperties]);

  // Set property sellable (owner only)
  const setPropertySellableAndUpdatePrice = useCallback(async () => {
    if (contract) {
      try {
        const newSalePriceScaled = sellableDetails.newSalePrice
          ? sellableDetails.newSalePrice
          : 0;
        if (sellableDetails.newSalePrice && (isNaN(sellableDetails.newSalePrice) || Number(sellableDetails.newSalePrice) <= 0)) {
          alert("Please enter a valid sale price in HBAR.");
          return;
        }

        const tx = await contract.setSellableAndUpdatePrice(
          sellableDetails.propertyId,
          sellableDetails.isSellable,
          newSalePriceScaled
        );
        await tx.wait();
        console.log("Sellable status updated to:", sellableDetails.isSellable);
        if (sellableDetails.newSalePrice && sellableDetails.isSellable) {
          console.log("New Sale Price Scaled:", newSalePriceScaled.toString());
        }

        alert("Property sellable status" + (sellableDetails.newSalePrice && sellableDetails.isSellable ? " and sale price" : "") + " updated successfully!");
        fetchProperties();
      } catch (error) {
        console.error("Error updating sellable status and sale price:", error);
        alert("Failed to update sellable status or sale price: " + error.message);
      }
    }
  }, [contract, sellableDetails, fetchProperties]);

  // Split property (admin only)
  const splitProperty = useCallback(async () => {
    if (contract && isAdmin) {
      try {
        const tx = await contract.splitProperty(splitDetails.propertyId, splitDetails.splitPercentage);
        await tx.wait();
        alert("Property split successfully!");
        fetchProperties();
      } catch (error) {
        console.error("Error splitting property:", error);
        alert("Failed to split property: " + error.message);
      }
    }
  }, [contract, isAdmin, splitDetails, fetchProperties]);

  // Update admins (admin only)
  const updateAdmins = useCallback(async () => {
    if (contract && isAdmin) {
      const { newAdmin1, newAdmin2 } = updateAdminDetails;
      if (!ethers.isAddress(newAdmin1) || !ethers.isAddress(newAdmin2)) {
        alert("Please enter valid Ethereum addresses for the new admins.");
        return;
      }
      try {
        const tx = await contract.updateAdmins(newAdmin1, newAdmin2);
        await tx.wait();
        alert("Admins updated successfully!");
        const newAdmin1Address = await contract.admin1();
        const newAdmin2Address = await contract.admin2();
        setAdmin1(newAdmin1Address);
        setAdmin2(newAdmin2Address);
        setIsAdmin(
          account.toLowerCase() === newAdmin1Address.toLowerCase() ||
          account.toLowerCase() === newAdmin2Address.toLowerCase()
        );
      } catch (error) {
        console.error("Error updating admins:", error);
        alert("Failed to update admins: " + error.message);
      }
    }
  }, [contract, isAdmin, updateAdminDetails, account]);

  // Check sale price
  const checkSalePrice = useCallback(async () => {
    if (contract) {
      try {
        const property = await contract.getProperty(salePriceCheck.propertyId);
        setSalePriceCheck({ ...salePriceCheck, price: property.salePrice.toString() });
        alert(`Sale Price for Property ${salePriceCheck.propertyId}: ${property.salePrice.toString()} HBAR`);
      } catch (error) {
        console.error("Error checking sale price:", error);
        alert("Failed to check sale price: " + error.message);
      }
    }
  }, [contract, salePriceCheck]);

  useEffect(() => {
    if (contract) {
      fetchProperties();
    }
  }, [contract, fetchProperties]);

  return (
    <div className="App">
      <h1>Property Management DApp</h1>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {!account ? (
        <button onClick={connectWallet}>Connect to MetaMask</button>
      ) : (
        <div>
          <p>Connected Account: {account}</p>
          <h2>All Properties</h2>
          <button onClick={fetchProperties}>Fetch Properties</button>
          {properties.length > 0 ? (
            <table className="property-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Owner Name</th>
                  <th>Gov UID</th>
                  <th>Address Line 1</th>
                  <th>Address Line 2</th>
                  <th>City</th>
                  <th>State</th>
                  <th>Country</th>
                  <th>PIN Code</th>
                  <th>Cost (HBAR)</th>
                  <th>MetaMask Account</th>
                  <th>Sellable</th>
                  <th>Sale Price (HBAR)</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => (
                  <tr key={property.id}>
                    <td>{property.id}</td>
                    <td>{property.ownerName}</td>
                    <td>{property.govUID}</td>
                    <td>{property.addressLine1}</td>
                    <td>{property.addressLine2}</td>
                    <td>{property.city}</td>
                    <td>{property.state}</td>
                    <td>{property.country}</td>
                    <td>{property.pinCode}</td>
                    <td>{property.cost}</td>
                    <td>{property.metaMaskAccount}</td>
                    <td>{property.isSellable ? "Yes" : "No"}</td>
                    <td>{property.salePrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No properties available.</p>
          )}
          {isAdmin && (
            <>
              <h2>Register Property (Admin Only)</h2>
              <input type="text" placeholder="Owner Name" value={registerDetails.ownerName} onChange={(e) => setRegisterDetails({ ...registerDetails, ownerName: e.target.value })} />
              <input type="text" placeholder="Government UID" value={registerDetails.govUID} onChange={(e) => setRegisterDetails({ ...registerDetails, govUID: e.target.value })} />
              <input type="text" placeholder="Address Line 1" value={registerDetails.addressLine1} onChange={(e) => setRegisterDetails({ ...registerDetails, addressLine1: e.target.value })} />
              <input type="text" placeholder="Address Line 2" value={registerDetails.addressLine2} onChange={(e) => setRegisterDetails({ ...registerDetails, addressLine2: e.target.value })} />
              <input type="text" placeholder="City" value={registerDetails.city} onChange={(e) => setRegisterDetails({ ...registerDetails, city: e.target.value })} />
              <input type="text" placeholder="State" value={registerDetails.state} onChange={(e) => setRegisterDetails({ ...registerDetails, state: e.target.value })} />
              <input type="text" placeholder="Country" value={registerDetails.country} onChange={(e) => setRegisterDetails({ ...registerDetails, country: e.target.value })} />
              <input type="text" placeholder="PIN Code" value={registerDetails.pinCode} onChange={(e) => setRegisterDetails({ ...registerDetails, pinCode: e.target.value })} />
              <input type="text" placeholder="Cost (HBAR)" value={registerDetails.cost} onChange={(e) => setRegisterDetails({ ...registerDetails, cost: e.target.value })} />
              <input type="text" placeholder="Owner MetaMask Account" value={registerDetails.metaMaskAccount} onChange={(e) => setRegisterDetails({ ...registerDetails, metaMaskAccount: e.target.value })} />
              <input type="text" placeholder="Sale Price (HBAR)" value={registerDetails.salePrice} onChange={(e) => setRegisterDetails({ ...registerDetails, salePrice: e.target.value })} />
              <button onClick={registerProperty}>Register Property</button>

              <h2>Update Admins (Admin Only)</h2>
              <input type="text" placeholder="New Admin1 Address" value={updateAdminDetails.newAdmin1} onChange={(e) => setUpdateAdminDetails({ ...updateAdminDetails, newAdmin1: e.target.value })} />
              <input type="text" placeholder="New Admin2 Address" value={updateAdminDetails.newAdmin2} onChange={(e) => setUpdateAdminDetails({ ...updateAdminDetails, newAdmin2: e.target.value })} />
              <button onClick={updateAdmins}>Update Admins</button>
            </>
          )}
          <h2>Buy Property</h2>
          <input type="text" placeholder="Property ID" value={buyDetails.propertyId} onChange={(e) => setBuyDetails({ ...buyDetails, propertyId: e.target.value })} />
          <input type="text" placeholder="New Owner Name" value={buyDetails.newOwnerName} onChange={(e) => setBuyDetails({ ...buyDetails, newOwnerName: e.target.value })} />
          <input type="text" placeholder="New Gov UID" value={buyDetails.newGovUID} onChange={(e) => setBuyDetails({ ...buyDetails, newGovUID: e.target.value })} />
          <input type="text" placeholder="New MetaMask Account" value={buyDetails.newMetaMaskAccount} onChange={(e) => setBuyDetails({ ...buyDetails, newMetaMaskAccount: e.target.value })} />
          <input type="text" placeholder="Amount to Send (HBAR)" value={buyDetails.amount} onChange={(e) => setBuyDetails({ ...buyDetails, amount: e.target.value })} />
          <button onClick={buyProperty}>Buy Property</button>

          <h2>Check Sale Price</h2>
          <input type="text" placeholder="Property ID" value={salePriceCheck.propertyId} onChange={(e) => setSalePriceCheck({ ...salePriceCheck, propertyId: e.target.value })} />
          <button onClick={checkSalePrice}>Check Sale Price</button>
          {salePriceCheck.price && <p>Sale Price: {salePriceCheck.price} HBAR</p>}

          <h2>Set Property Sellable (Owner Only)</h2>
          <input type="text" placeholder="Property ID" value={sellableDetails.propertyId} onChange={(e) => setSellableDetails({ ...sellableDetails, propertyId: e.target.value })} />
          <select value={sellableDetails.isSellable} onChange={(e) => setSellableDetails({ ...sellableDetails, isSellable: e.target.value === "true" })}>
            <option value={true}>Sellable</option>
            <option value={false}>Not Sellable</option>
          </select>
          <input
            type="text"
            placeholder="New Sale Price (HBAR, optional)"
            value={sellableDetails.newSalePrice}
            onChange={(e) => setSellableDetails({ ...sellableDetails, newSalePrice: e.target.value })}
          />
          <button onClick={setPropertySellableAndUpdatePrice}>Set Sellable Status and Update Price</button>

          {isAdmin && (
            <>
              <h2>Split Property (Admin Only)</h2>
              <input type="text" placeholder="Property ID" value={splitDetails.propertyId} onChange={(e) => setSplitDetails({ ...splitDetails, propertyId: e.target.value })} />
              <input type="text" placeholder="Split Percentage (1-99)" value={splitDetails.splitPercentage} onChange={(e) => setSplitDetails({ ...splitDetails, splitPercentage: e.target.value })} />
              <button onClick={splitProperty}>Split Property</button>
            </>
          )}
        </div>
      )}
      <footer style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        {admin1 && admin2 ? (
          <p>Admin1: {admin1} | Admin2: {admin2}</p>
        ) : (
          <p>Admin addresses not loaded yet.</p>
        )}
      </footer>
    </div>
  );
}

export default App;
