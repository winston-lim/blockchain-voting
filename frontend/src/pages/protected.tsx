import {
	Box,
	Container,
	Flex,
	Heading,
	Text,
	Link,
	Button,
	Image,
	useMediaQuery,
	useToast,
} from "@chakra-ui/react";
import { FC, useState } from "react";
import { useCookies } from "react-cookie";

const Protected: FC = () => {
	const toast = useToast();
	const [isMobile] = useMediaQuery("(max-width: 768px)", {});
	const [isLoading, setIsLoading] = useState(false);
	const [cookies, setCookie, removeCookie] = useCookies();

	console.log(cookies);

	const handleFormSubmit = () => {};

	return (
		<Box
			as="section"
			py={10}
			bg="gray.50"
			className="hero-area"
			boxShadow="sm"
			borderRadius="md"
		>
			<Container maxW="container.xl">
				<Flex
					wrap="wrap"
					direction={isMobile ? "column" : "row"}
					align="center"
					justify="center"
					minH="100vh"
				>
					<Flex
						w={isMobile ? "100%" : "50%"}
						align="center"
						justify="center"
						p={5}
					>
						<Box
							p={8}
							bg="white"
							borderRadius="lg"
							boxShadow="lg"
							className="hero-content-div"
						>
							<Box className="hero-content">
								<Heading as="h1" size="xl" mb={4} color="orange.400">
									VoteSecure
								</Heading>
								<Text mb={4} color="gray.600">
									VoteSecure uses a integrates with the SingPass development
									sandbox
								</Text>
								<hr style={{ borderColor: "gray.200", marginBottom: "16px" }} />
								<Text mt={4} mb={6} color="gray.600">
									To start the SingPass login and consent process, click on the
									"Login" button below.
								</Text>
							</Box>
							<Box as="form" id="formAuthorize">
								<Button
									colorScheme="orange"
									variant="solid"
									size="lg"
									onClick={handleFormSubmit}
									isLoading={isLoading}
								>
									Login
								</Button>
							</Box>
							<hr style={{ borderColor: "gray.200", marginTop: "16px" }} />
							<Text fontSize="sm" mt={4} color="gray.500">
								Note: refer to the{" "}
								<Link
									href="https://www.ndi-api.gov.sg/library/myinfo/resources-personas"
									target="_blank"
									rel="noopener noreferrer"
									color="orange.400"
								>
									Personas
								</Link>{" "}
								on the NDI Developer and Partner Portal for the test accounts to
								be used.
							</Text>
						</Box>
					</Flex>

					{!isMobile && (
						<Flex
							w="50%"
							align="center"
							justify="center"
							className="mobile-hidden"
							p={5}
						>
							<Box
								className="right-img"
								bg="white"
								borderRadius="lg"
								boxShadow="lg"
								p={4}
							>
								<Box data-depth="0.40" className="layer">
									<Box className="right-img-bg-1" bg="orange.100" />
								</Box>
								<Box data-depth="0.30" className="layer">
									<Box className="right-img-bg-2" bg="orange.200" />
								</Box>
								<Box data-depth="0.40" className="layer">
									<Image
										src="banner-personal.png"
										alt="Banner"
										className="right-img-img"
										borderRadius="md"
										boxShadow="md"
									/>
								</Box>
							</Box>
						</Flex>
					)}
				</Flex>
			</Container>
		</Box>
	);
};

export default Protected;