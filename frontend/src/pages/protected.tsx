import { Box, Container, Flex, useToast } from "@chakra-ui/react";
import { FC, useEffect, useState } from "react";
import { useCookies } from "react-cookie";
import PersonalInformationSection from "../components/personal-information";
import { PersonalInformationData } from "../types/api";
import { GET_PERSONAL_DATA_API } from "../constants/backend";

const Protected: FC = () => {
	const toast = useToast();
	const [data, setData] = useState<PersonalInformationData | undefined>();
	const [cookies, setCookie, removeCookie] = useCookies(["sid", "code"]);

	useEffect(() => {
		const fetchPersonalInformation = async () => {
			try {
				const response = await fetch(GET_PERSONAL_DATA_API, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						authCode: cookies["code"],
						sid: cookies["sid"],
					}),
				}).then((response) => response.json());
				setData(response);
			} catch (e) {
				toast({
					title: "Error",
					description: (e as Error).message,
					status: "error",
					duration: 5000,
					isClosable: true,
				});
			}
		};
		if (!data) {
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
			<Container maxW="container.xl">
				<Flex
					wrap="wrap"
					direction={"column"}
					align="center"
					justify="center"
					minH="100vh"
				>
					<PersonalInformationSection data={data} />
				</Flex>
			</Container>
		</Box>
	);
};

export default Protected;
