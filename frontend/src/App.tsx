import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ChakraProvider, theme } from "@chakra-ui/react";
import Login from "./pages/login";
import Protected from "./pages/protected";

const router = createBrowserRouter([
	{
		path: "/",
		element: <Login />,
	},
	{
		path: "/protected",
		element: <Protected />,
	},
]);

export const App = () => {
	return (
		<ChakraProvider theme={theme}>
			<RouterProvider router={router} />
		</ChakraProvider>
	);
};
