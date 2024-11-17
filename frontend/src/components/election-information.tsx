import {
	Button,
	Center,
	Container,
	Flex,
	Heading,
	Select,
	Spinner,
	Table,
	TableContainer,
	Tbody,
	Td,
	Text,
	Th,
	Tr,
	useClipboard,
	useToast,
} from "@chakra-ui/react";
import { FC, useEffect, useState } from "react";
import { COOKIE_NAMES, FETCH_ELECTION_INFO } from "../constants/backend";
import { useElectionStore } from "../store/election";
import { useCookies } from "react-cookie";

interface ElectionData {
	electionId: string;
	startTime: string;
	endTime: string;
	choices: {
		original: string;
		hashed: string;
	}[];
	publicKey: string;
}

const ElectionInformation: FC = () => {
	const toast = useToast();
	const [cookies] = useCookies(COOKIE_NAMES);
	const [data, setData] = useState<ElectionData | undefined>(undefined);
	const [choice, setChoice] = useState<string | undefined>();
	const { vote, setVote } = useElectionStore();
	const {
		onCopy,
		value: txHash,
		setValue: setTxHash,
		hasCopied,
	} = useClipboard("");
	useEffect(() => {
		if (!data) {
			const electionId = 1;
			fetch(`${FETCH_ELECTION_INFO}/${electionId}`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			})
				.then((response) => {
					if (!response.ok) {
						throw new Error("network error");
					}
					return response.json();
				})
				.then((resp) => {
					setData(resp);
				})
				.catch((e) => {
					toast({
						title: "Error",
						description: (e as Error).message,
						status: "error",
						duration: 3000,
						isClosable: true,
					});
				});
		}
	}, [data, toast]);

	const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		setChoice(event.target.value);
	};

	const handleVote = () => {
		if (!choice) {
			return;
		}
		const url = "http://127.0.0.1:3001/api/castVote";
		const options = {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				sid: cookies["sid"],
				vote: choice,
			}),
		};
		fetch(url, options)
			.then((resp) => {
				return resp.json();
			})
			.then((resp) => {
				if (resp.error) {
					throw new Error(resp.error);
				}
				setVote(choice);
				setTxHash(resp?.receipt?.logs?.[0].transactionHash);
			})
			.catch((e) => {
				toast({
					title: "Error",
					description: (e as Error).message,
					status: "error",
					duration: 3000,
					isClosable: true,
				});
			});
	};

	if (!data) {
		return (
			<Container
				maxW="container.md"
				bg="white"
				p={8}
				boxShadow="sm"
				borderRadius="md"
			>
				<Heading as="h2" size="lg" color="orange.400" mb={6} textAlign="center">
					Election Information
				</Heading>
				<Center minH="200px">
					<Spinner size="xl" color="orange.400" />
				</Center>
			</Container>
		);
	}
	return (
		<Container
			maxW="container.md"
			bg="white"
			p={8}
			boxShadow="sm"
			borderRadius="md"
		>
			<Heading as="h1" size="lg" color="orange.400" mb={6} textAlign="center">
				Election
			</Heading>
			<Heading as="h3" size="md" color="orange.400" mb={6} textAlign="center">
				Election Information
			</Heading>

			<TableContainer
				border="1px"
				borderColor="gray.200"
				borderRadius="md"
				boxShadow="sm"
				bg="white"
			>
				<Table variant="simple">
					<Tbody>
						<Tr>
							<Th color="gray.600">Election ID</Th>
							<Td color="gray.700">{data?.electionId}</Td>
						</Tr>
						<Tr>
							<Th color="gray.600">Start Time</Th>
							<Td color="gray.700">{data?.startTime}</Td>
						</Tr>
						<Tr>
							<Th color="gray.600">End Time</Th>
							<Td color="gray.700">{data?.endTime}</Td>
						</Tr>
						<Tr>
							<Th color="gray.600">Choices</Th>
							<Td color="gray.700">
								<ul style={{ paddingLeft: "1em" }}>
									{data?.choices.map((choice, index) => (
										<li key={index}>
											{choice.original} ({choice.hashed})
										</li>
									))}
								</ul>
							</Td>
						</Tr>
						<Tr>
							<Th color="gray.600">Public Key</Th>
							<Td color="gray.700" wordBreak="break-all">
								{data?.publicKey}
							</Td>
						</Tr>
					</Tbody>
				</Table>
			</TableContainer>
			<Heading
				as="h3"
				size="md"
				color="orange.400"
				mt={6}
				mb={6}
				textAlign="center"
			>
				Election Status
			</Heading>
			{vote ? (
				<Flex direction="column" gap={3}>
					<Text>
						Voted for <b>{vote}</b>
					</Text>
					<Flex mb={2} alignItems={"center"} justifyContent={"center"}>
						<Text>
							<b>{txHash}</b>
						</Text>
						<Button onClick={onCopy}>{hasCopied ? "Copied!" : "Copy"}</Button>
					</Flex>
				</Flex>
			) : (
				<Flex direction="column" gap={3}>
					<Select
						placeholder="Select option"
						value={vote}
						onChange={handleSelectChange}
					>
						{data.choices.map((choice) => (
							<option key={choice.hashed} value={choice.original}>
								{choice.original}
							</option>
						))}
					</Select>
					<Button
						color="white"
						bg="orange.400"
						variant="solid"
						type="submit"
						onClick={handleVote}
					>
						Vote
					</Button>
				</Flex>
			)}
		</Container>
	);
};

export default ElectionInformation;
