import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { config } from "@/config";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: config.title,
	description: "A channel frame",
	other: {
		"fc:frame": "vNext",
		"fc:frame:image": config.startImage,
		"fc:frame:button:1": "Request to Join",
		"fc:frame:button:1:action": "post",
		"fc:frame:button:1:target": "https://depe-membership-frame-s56f.vercel.app/api/join",
		"fc:frame:button:2": "Buy DEPE",
		"fc:frame:button:2:action": "link",
		"fc:frame:button:2:target": "https://mint.club/token/degen/DEPE",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={inter.className}>{children}</body>
		</html>
	);
}
