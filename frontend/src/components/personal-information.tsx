import {
	Container,
	Heading,
	Table,
	TableContainer,
	Tbody,
	Td,
	Th,
	Tr,
} from "@chakra-ui/react";
import { FC } from "react";
import { PersonalInformationData } from "../types/api";

type PersonalInformationProps = {
	data: PersonalInformationData;
};

const PersonalInformation: FC<PersonalInformationProps> = ({ data }) => {
	return (
		<Container
			maxW="container.md"
			bg="white"
			p={8}
			boxShadow="sm"
			borderRadius="md"
		>
			<Heading as="h2" size="lg" color="orange.400" mb={6} textAlign="center">
				Personal Information
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
						{data.uinfin?.value && (
							<Tr>
								<Th color="gray.600">UIN/FIN</Th>
								<Td color="gray.700">{data.uinfin.value}</Td>
							</Tr>
						)}
						{data.name?.value && (
							<Tr>
								<Th color="gray.600">Name</Th>
								<Td color="gray.700">{data.name.value}</Td>
							</Tr>
						)}
						{data.sex?.desc && (
							<Tr>
								<Th color="gray.600">Sex</Th>
								<Td color="gray.700">{data.sex.desc}</Td>
							</Tr>
						)}
						{data.race?.desc && (
							<Tr>
								<Th color="gray.600">Race</Th>
								<Td color="gray.700">{data.race.desc}</Td>
							</Tr>
						)}
						{data.nationality?.desc && (
							<Tr>
								<Th color="gray.600">Nationality</Th>
								<Td color="gray.700">{data.nationality.desc}</Td>
							</Tr>
						)}
						{data.dob?.value && (
							<Tr>
								<Th color="gray.600">Date of Birth</Th>
								<Td color="gray.700">{data.dob.value}</Td>
							</Tr>
						)}
						{data.email?.value && (
							<Tr>
								<Th color="gray.600">Email</Th>
								<Td color="gray.700">{data.email.value}</Td>
							</Tr>
						)}
						{data.mobileno?.nbr?.value && (
							<Tr>
								<Th color="gray.600">Mobile Number</Th>
								<Td color="gray.700">
									{`+${data.mobileno.areacode?.value} ${data.mobileno.prefix?.value}-${data.mobileno.nbr.value}`}
								</Td>
							</Tr>
						)}
						{data.regadd && (
							<Tr>
								<Th color="gray.600">Address</Th>
								<Td color="gray.700">
									{`${data.regadd.block?.value} ${data.regadd.street?.value}, #${data.regadd.floor?.value}-${data.regadd.unit?.value}, ${data.regadd.postal?.value}`}
								</Td>
							</Tr>
						)}
						{data.marital?.desc && (
							<Tr>
								<Th color="gray.600">Marital Status</Th>
								<Td color="gray.700">{data.marital.desc}</Td>
							</Tr>
						)}
						{data.edulevel?.desc && (
							<Tr>
								<Th color="gray.600">Education Level</Th>
								<Td color="gray.700">{data.edulevel.desc}</Td>
							</Tr>
						)}
						{data.noaBasic?.amount?.value && (
							<Tr>
								<Th color="gray.600">NOA Amount</Th>
								<Td color="gray.700">{`$${data.noaBasic.amount.value.toLocaleString()}`}</Td>
							</Tr>
						)}
					</Tbody>
				</Table>
			</TableContainer>
		</Container>
	);
};

export default PersonalInformation;
