import { Object, Property } from 'fabric-contract-api';

@Object()
export class EscrowContract {
    @Property()
    public readonly docType?: string;

    @Property()
    public ID: string;

    @Property()
    public Client: string;

    @Property()
    public Freelancer: string;

    @Property()
    public Amount: number;

    @Property()
    public Status: 'OPEN' | 'CLOSED';

    @Property()
    public ClientApproval: boolean;

    @Property()
    public FreelancerApproval: boolean;
}