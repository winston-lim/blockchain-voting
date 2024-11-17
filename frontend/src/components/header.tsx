import React from "react";
import { Box, Flex, Button, Spacer, Text, Container } from "@chakra-ui/react";
import { useCookies } from "react-cookie";
import { COOKIE_NAMES } from "../constants/backend";
import { PersonalInformationData } from "../types/api";

type HeaderProps = {
	data: PersonalInformationData;
};

const Header: React.FC<HeaderProps> = ({ data }: HeaderProps) => {
	const removeCookie = useCookies(COOKIE_NAMES)[2];
	const handleLogout = () => {
		for (let cookie in COOKIE_NAMES) {
			removeCookie(cookie);
		}
		localStorage.clear();
		window.location.pathname = "/";
	};

	return (
		<Container
			maxW="container.md"
			bg="orange.200"
			p={8}
			boxShadow="sm"
			borderRadius="md"
		>
			<Flex align="center">
				{/* Logo/Title Section */}
				<Box>
					<Text fontSize="2xl" color="orange.400" fontWeight="bold">
						{data.uinfin?.value || "VoteSecure"}
					</Text>
				</Box>

				<Spacer />

				{/* Logout Button */}
				<Button
					color="orange.400"
					bg="orange.100"
					variant="solid"
					onClick={handleLogout}
				>
					Logout
				</Button>
			</Flex>
		</Container>
	);
};

export default Header;
