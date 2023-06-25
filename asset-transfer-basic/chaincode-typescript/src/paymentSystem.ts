import { Context, Contract, Info, Transaction } from 'fabric-contract-api';
import { Account } from './account';
import { EscrowContract } from './escrowContract';

@Info({ title: 'PaymentSystem', description: 'Smart contract for managing payments between accounts' })
export class PaymentSystemContract extends Contract {

    @Transaction()
    public async InitLedger(ctx: Context): Promise<void> {
        const accounts: Account[] = [
            {
                docType: 'account',
                ID: 'client1',
                Balance: 5000,
            },
            {
                docType: 'account',
                ID: 'freelancer1',
                Balance: 0,
            }
        ];

        for (const account of accounts) {
            await ctx.stub.putState(account.ID, Buffer.from(JSON.stringify(account)));
            console.info(`Account ${account.ID} initialized`);
        }
    }

    // GetAccountBalance returns the balance of the account with the given id.
    @Transaction(false)
    public async GetAccountBalance(ctx: Context, id: string): Promise<string> {
        const accountJSON = await ctx.stub.getState(id);
        if (!accountJSON || accountJSON.length === 0) {
            throw new Error(`The account ${id} does not exist`);
        }
        const account = JSON.parse(accountJSON.toString()) as Account;
        return account.Balance.toString();
    }

    // GetAllTransactions returns all transactions stored in the world state.
    @Transaction(false)
    public async GetAllTransactions(ctx: Context): Promise<string> {
        const allResults = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            allResults.push(record);
            result = await iterator.next();
        }
        return JSON.stringify(allResults);
    }

    // Create a new escrow contract.
    @Transaction()
    public async CreateEscrowContract(ctx: Context, id: string, client: string, freelancer: string, amount: number): Promise<void> {
        const escrowContractJSON = await ctx.stub.getState(id);
        const clientAccountJSON = await ctx.stub.getState(client);
        const freelancerAccountJSON = await ctx.stub.getState(freelancer);
        
        if (escrowContractJSON.length > 0) {
            throw new Error(`The escrow contract ${id} already exists`);
        }

        if (clientAccountJSON.length === 0) {
            throw new Error(`The client ${client} does not exist`);
        }

        if (freelancerAccountJSON.length === 0) {
            throw new Error(`The freelancer ${freelancer} does not exist`);
        }

        const clientAccount = JSON.parse(clientAccountJSON.toString()) as Account;
        if (clientAccount.Balance < amount) {
            throw new Error('Insufficient funds');
        }
        clientAccount.Balance -= amount;
        await ctx.stub.putState(client, Buffer.from(JSON.stringify(clientAccount)));

        const contract: EscrowContract = {
            ID: id,
            docType: 'contract',
            Client: client,
            Freelancer: freelancer,
            Amount: amount,
            Status: 'OPEN',
            ApprovedByClient: false,
            ApprovedByFreelancer: false,
            CanceledByClient: false,
            CanceledByFreelancer: false,
        };
        await ctx.stub.putState(id, Buffer.from(JSON.stringify(contract)));
    }

    // Approve the work for an escrow contract.
    @Transaction()
    public async ApproveWork(ctx: Context, contractID: string, approver: string): Promise<void> {
        const contractJSON = await ctx.stub.getState(contractID);
        const contract = JSON.parse(contractJSON.toString()) as EscrowContract;

        if (contract.Status === 'OPEN') {
            if (approver === contract.Client) {
                contract.ApprovedByClient = true;
            } else if (approver === contract.Freelancer) {
                contract.ApprovedByFreelancer = true;
            } else {
                throw new Error(`The approver ${approver} is not part of the contract`);
            }
    
            // Automatically close the contract if both parties have approved
            if (contract.ApprovedByClient && contract.ApprovedByFreelancer) {
                const freelancerAccountJSON = await ctx.stub.getState(contract.Freelancer);
                const freelancerAccount = JSON.parse(freelancerAccountJSON.toString()) as Account;
                freelancerAccount.Balance += contract.Amount;
                await ctx.stub.putState(contract.Freelancer, Buffer.from(JSON.stringify(freelancerAccount)));
    
                contract.Status = 'CLOSED';
            }
    
            await ctx.stub.putState(contractID, Buffer.from(JSON.stringify(contract)));
        } else {
            throw new Error('The contract is already closed or canceled by both parties');
        }
    }

    @Transaction()
    public async CancelContract(ctx: Context, contractID: string, canceler: string): Promise<void> {
        const contractJSON = await ctx.stub.getState(contractID);
        const contract = JSON.parse(contractJSON.toString()) as EscrowContract;

        if (contract.Status === 'OPEN') {
            if (canceler === contract.Client) {
                contract.CanceledByClient = true;
            } else if (canceler === contract.Freelancer) {
                contract.CanceledByFreelancer = true;
            } else {
                throw new Error(`The canceler ${canceler} is not part of the contract`);
            }

            // Automatically cancel the contract if both parties have canceled
            if (contract.CanceledByClient && contract.CanceledByFreelancer) {
                const clientAccountJSON = await ctx.stub.getState(contract.Client);
                const clientAccount = JSON.parse(clientAccountJSON.toString()) as Account;
                clientAccount.Balance += contract.Amount;
                await ctx.stub.putState(contract.Client, Buffer.from(JSON.stringify(clientAccount)));

                contract.Status = 'CANCELED';
            }

            await ctx.stub.putState(contractID, Buffer.from(JSON.stringify(contract)));
        } else {
            throw new Error('The contract is already closed or canceled by both parties');
        }
    }
}
