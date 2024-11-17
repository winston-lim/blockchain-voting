import {
	Box,
	Center,
	Container,
	Flex,
	Spinner,
	useToast,
} from "@chakra-ui/react";
import { FC, useEffect, useState } from "react";
import { useCookies } from "react-cookie";
import PersonalInformation from "../components/personal-information";
import { PersonalInformationData } from "../types/api";
import { COOKIE_NAMES, GET_PERSONAL_DATA_API } from "../constants/backend";
import Header from "../components/header";
import ElectionInformation from "../components/election-information";

const Protected: FC = () => {
	const toast = useToast();
	const [data, setData] = useState<PersonalInformationData | undefined>();
	const [cookies] = useCookies(COOKIE_NAMES);

	useEffect(() => {
		const fetchPersonalInformation = async () => {
			console.log({
				authCode: cookies["code"],
				sid: cookies["sid"],
			});
			return fetch(GET_PERSONAL_DATA_API, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					authCode: cookies["code"],
					sid: cookies["sid"],
				}),
			})
				.then((response) => {
					if (!response.ok) {
						throw new Error();
					}
					return response.json();
				})
				.then((response) => setData(response))
				.catch((e) => {
					console.error(e);
				});
		};
		if (!data && cookies["sid"] && cookies["code"]) {
			fetchPersonalInformation();
		}
	}, [cookies, data, toast]);

	return (
		<Box
			as="section"
			py={10}
			bg="gray.50"
			className="hero-area"
			boxShadow="sm"
			borderRadius="md"
			textAlign="center"
		>
			{!data ? (
				<>
					<Center minH="200px">
						<Spinner size="xl" color="orange.400" />
					</Center>
				</>
			) : (
				<Container maxW="container.xl">
					<Flex
						wrap="wrap"
						direction={"column"}
						align="center"
						justify="center"
						minH="100vh"
					>
						<Header data={data} />
						<PersonalInformation data={data} />
						<Box h={2} />
						<ElectionInformation />
					</Flex>
				</Container>
			)}
		</Box>
	);
};

export default Protected;
