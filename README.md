To run this application, it is necessary to have Fabric installed.

```
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh && chmod +x install-fabric.sh
```

Install only the docker images and binary
```
./install-fabric.sh docker binary
```

To create a test network, in the `test-network` directory run:

```bash
bash reload.sh
```

To start the api server, in the `asset-transfer-basic/application-gateway-typescript` directory, run:

```bash
npm install
npm start
```

This application will init ledger with two accounts, `client1` and `freelancer1`. The client1 will init with 5000 units in your wallet, and the `freelancer1` with 0 units in order to test the transactions.

The endpoints will be exposed in the port 3000, you can access by http requests, for example:

List all transactions
```bash
curl -X GET http://localhost:3000/transactions
```

Create a new escrow contract
```bash
curl -X POST http://localhost:3000/create-escrow-contract -H "Content-Type: application/json" -d '{"client": "client1", "freelancer": "freelancer1", "value": "1000"}'
```

Approve work (the <id> can be find in `/transactions` endpoint)
```bash
curl -X POST http://localhost:3000/approve-work -H "Content-Type: application/json" -d '{"contractId": <id>, "approver": "<client1 or freelancer1>"}'
```

Cancel contract
```bash
curl -X POST http://localhost:3000/cancel-contract -H "Content-Type: application/json" -d '{"contractId": <id>, "canceller": "<client1 or freelancer1>"}'
```

Get account ballance
```bash
curl -X GET http://localhost:3000/account/<client1 or freelancer1>/balance
```

If you want to use insomnia to call this requests, import the `test-api-insomnia.json` file in your insomnia.