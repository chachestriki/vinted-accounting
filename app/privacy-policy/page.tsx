import Link from "next/link";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";

// CHATGPT PROMPT TO GENERATE YOUR PRIVACY POLICY — replace with your own data 👇

// 1. Go to https://chat.openai.com/
// 2. Copy paste bellow
// 3. Replace the data with your own (if needed)
// 4. Paste the answer from ChatGPT directly in the <pre> tag below

// You are an excellent lawyer.

// I need your help to write a simple privacy policy for my website. Here is some context:
// - Website: https://vintflow.com
// - Name: Vintflow
// - Description: A JavaScript code boilerplate to help entrepreneurs launch their startups faster
// - User data collected: name, email and payment information
// - Non-personal data collection: web cookies
// - Purpose of Data Collection: Order processing
// - Data sharing: we do not share the data with any other parties
// - Children's Privacy: we do not collect any data from children
// - Updates to the Privacy Policy: users will be updated by email
// - Contact information: vintflow@gmail.com

// Please write a simple privacy policy for my site. Add the current date.  Do not add or explain your reasoning. Answer:

export const metadata = getSEOTags({
  title: `Privacy Policy | ${config.appName}`,
  canonicalUrlRelative: "/privacy-policy",
});

const PrivacyPolicy = () => {
  return (
    <main className="max-w-xl mx-auto">
      <div className="p-5">
        <Link href="/" className="btn btn-ghost">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M15 10a.75.75 0 01-.75.75H7.612l2.158 1.96a.75.75 0 11-1.04 1.08l-3.5-3.25a.75.75 0 010-1.08l3.5-3.25a.75.75 0 111.04 1.08L7.612 9.25h6.638A.75.75 0 0115 10z"
              clipRule="evenodd"
            />
          </svg>{" "}
          Back
        </Link>
        <h1 className="text-3xl font-extrabold pb-6">
          Privacy Policy for {config.appName}
        </h1>

        <pre
          className="leading-relaxed whitespace-pre-wrap"
          style={{ fontFamily: "sans-serif" }}
        >
          {`Privacy Policy — Vintflow
Last updated: December 2, 2025

This Privacy Policy explains how Vintflow (“we”, “our”, “us”) collects, uses, and protects your information when you use https://vintflow.com
 (“Website”). By using the Website, you agree to the practices described in this policy.

1. Information We Collect
Personal Data

We collect the following personal information when you place an order or interact with our Website:

Name

Email address

Payment information

Non-Personal Data

We use web cookies and similar technologies to gather non-personal information such as browser type, device details, and site usage statistics.

2. Purpose of Data Collection

We collect and process your data solely for the purpose of order processing, including confirming purchases, providing access to your downloads, and communicating with you about your order.

3. Data Sharing

We do not share, sell, or distribute your personal data to any third parties.

4. Data Security

We take reasonable measures to protect your information from unauthorized access, alteration, or disclosure.

5. Children’s Privacy

We do not knowingly collect personal information from children. If we become aware that we have received information from a child, we will delete it promptly.

6. Cookies

Cookies are used to enhance user experience and analyze website usage. You may disable cookies through your browser settings, though some features of the Website may not function properly.

7. Updates to This Privacy Policy

We may update this Privacy Policy periodically. If changes are made, users will be notified by email using the address provided during their purchase.

8. Contact

If you have any questions or concerns regarding this Privacy Policy, please contact us at:
vintflow@gmail.com

By using the Website, you acknowledge that you have read and agreed to this Privacy Policy.`}
        </pre>
      </div>
    </main>
  );
};

export default PrivacyPolicy;
