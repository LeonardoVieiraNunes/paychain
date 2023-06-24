To run this application, it is necessary to have Fabric installed.

```
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh && chmod +x install-fabric.sh
```

Install only the docker images and binary
```
./install-fabric.sh docker binary
```

To create a test network, in the test-network directory run:

```
./network.sh up createChannel -c mychannel -ca
```

Deploy the created contracts
```
./network.sh deployCC -ccn basic -ccp ../asset-transfer-basic/chaincode-typescript/ -ccl typescript
```

