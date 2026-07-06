import { type ExecuteParams } from "@avail-project/nexus-core";
import DepositModal from "./components/deposit-modal";
import { type Address } from "viem";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useNexus } from "../nexus/NexusProvider";
import SimpleDeposit from "./components/simple-deposit";

export interface BaseDepositProps {
  address: Address;
  token?: string;
  chain: number;
  chainOptions?: {
    id: number;
    name: string;
    logo: string;
  }[];
  depositExecute: (
    token: string,
    amount: string,
    chainId: number,
    userAddress: `0x${string}`
  ) => Omit<ExecuteParams, "toChainId">;
}

interface NexusDepositProps extends BaseDepositProps {
  heading?: string;
  embed?: boolean;
  destinationLabel?: string;
}

const NexusDeposit = ({
  address,
  token = "USDC",
  chain,
  chainOptions, // pass to customise sources displayed, if not provided, all sources will be shown
  heading = "Deposit USDC",
  embed = false,
  destinationLabel,
  depositExecute,
}: NexusDepositProps) => {
  const { supportedChainsAndTokens } = useNexus();
  const formatedChainOptions =
    chainOptions ??
    supportedChainsAndTokens?.map((chain) => {
      return {
        id: chain.id,
        name: chain.name,
        logo: chain.logo,
      };
    });
  if (embed) {
    return (
      <Card>
        <CardHeader className="px-3">
          <CardTitle>{heading}</CardTitle>
        </CardHeader>
        <CardContent className="px-3">
          <SimpleDeposit
            address={address}
            token={token}
            chain={chain}
            chainOptions={formatedChainOptions}
            destinationLabel={destinationLabel}
            depositExecute={depositExecute}
          />
        </CardContent>
      </Card>
    );
  }
  return (
    <DepositModal
      address={address}
      token={token}
      chain={chain}
      chainOptions={formatedChainOptions}
      heading={heading}
      destinationLabel={destinationLabel}
      depositExecute={depositExecute}
    />
  );
};

export default NexusDeposit;
