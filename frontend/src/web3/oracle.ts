import { formatUnits, type Address } from 'viem'
import { useReadContract } from 'wagmi'
import { useAuth } from '../contexts/AuthContext'
import { localDeployment } from './generated/localDeployment'
import { isLocalChain, targetChain } from './config'

const aggregatorAbi = [
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  {
    type: 'function',
    name: 'latestRoundData',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { type: 'uint80', name: 'roundId' },
      { type: 'int256', name: 'answer' },
      { type: 'uint256', name: 'startedAt' },
      { type: 'uint256', name: 'updatedAt' },
      { type: 'uint80', name: 'answeredInRound' },
    ],
  },
] as const

const configuredAddress = import.meta.env.VITE_ETH_USD_FEED_ADDRESS?.trim()
const localAddress = localDeployment.oracle.ethUsdFeed
const feedAddress = (configuredAddress || (isLocalChain ? localAddress : undefined)) as Address | undefined

export function useEthUsdPrice() {
  const { networkMode } = useAuth()
  const query = useReadContract({
    address: feedAddress,
    abi: aggregatorAbi,
    functionName: 'latestRoundData',
    chainId: targetChain.id,
    query: { enabled: networkMode === 'onchain' && !!feedAddress, refetchInterval: 30_000 },
  })
  const answer = query.data?.[1]
  const updatedAt = query.data?.[3]
  const price = answer !== undefined && answer > 0n ? `$${formatUnits(answer, 8)}` : undefined
  return {
    configured: !!feedAddress,
    simulated: isLocalChain,
    isLoading: query.isLoading,
    isError: networkMode === 'onchain' && (query.isError || (answer !== undefined && answer <= 0n)),
    price,
    updatedAt,
  }
}
