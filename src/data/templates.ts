// Text sources for the synthetic data generator (SPEC.md section 5).
// All product names are fictional. No real brands appear anywhere.
import type { Category } from "../types";

export const PRODUCTS = [
  "Northwind Office Suite",
  "Northwind PDF Studio",
  "Northwind Backup Pro",
  "Northwind Secure Shield",
  "Northwind Photo Editor",
  "Northwind Project Planner",
];

export const DEVICES = ["my laptop", "my work computer", "the new office PC", "my home desktop", "a second laptop", "our shared workstation"];

/** Mixed Dutch, German and English names. Language follows the name origin. */
export const NAMES: Record<"nl" | "de" | "en", { first: string[]; last: string[] }> = {
  nl: {
    first: ["Anouk", "Bram", "Daan", "Eva", "Femke", "Floris", "Iris", "Jesse", "Joost", "Julia", "Lars", "Lotte", "Maaike", "Niels", "Noor", "Ruben", "Sander", "Sophie", "Thijs", "Wouter", "Yara", "Koen", "Marloes", "Pieter"],
    last: ["de Jong", "Jansen", "de Vries", "van den Berg", "van Dijk", "Bakker", "Visser", "Smit", "Meijer", "de Boer", "Mulder", "de Groot", "Bos", "Vos", "Peters", "Hendriks", "van Leeuwen", "Dekker", "Brouwer", "de Wit", "Dijkstra", "Kok", "Jacobs", "Vermeulen"],
  },
  de: {
    first: ["Anna", "Ben", "Clara", "David", "Elias", "Emma", "Finn", "Hannah", "Jakob", "Johanna", "Leon", "Lina", "Lukas", "Marie", "Max", "Mia", "Paul", "Sophia", "Tim", "Laura", "Niklas", "Katrin", "Stefan", "Ute"],
    last: ["Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann", "Koch", "Richter", "Klein", "Wolf", "Schröder", "Neumann", "Schwarz", "Zimmermann", "Braun", "Krüger", "Hartmann", "Lange", "Werner", "Krause", "Lehmann"],
  },
  en: {
    first: ["Amelia", "Charlie", "Chloe", "Daniel", "Ella", "George", "Grace", "Harry", "Isla", "Jack", "James", "Lily", "Lucy", "Noah", "Oliver", "Olivia", "Oscar", "Ruby", "Sam", "Sophie", "Thomas", "Hannah", "Ryan", "Megan"],
    last: ["Smith", "Jones", "Taylor", "Brown", "Williams", "Wilson", "Johnson", "Davies", "Robinson", "Wright", "Thompson", "Evans", "Walker", "White", "Roberts", "Green", "Hall", "Wood", "Jackson", "Clarke", "Hughes", "Edwards", "Turner", "Parker"],
  },
};

/** Reserved example domains, so no real company is named. */
export const EMAIL_DOMAINS = ["example.com", "example.net", "example.org"];

export interface TextTemplate {
  subject: string;
  body: string;
}

/**
 * At least 8 templates per category. Placeholders: {product}, {key}, {order}, {device}, {seats}, {amount}.
 * None of these texts contains the urgent keywords from trigger 2. The generator adds an impact
 * sentence to a small share of tickets instead, so the urgent rate stays under control.
 */
export const TEMPLATES: Record<Category, TextTemplate[]> = {
  license_activation: [
    { subject: "License key not accepted", body: "I bought {product} yesterday and the license key {key} is not accepted. The activation screen says the key is invalid. Can you check it for me?" },
    { subject: "Activation limit reached", body: "When I try to activate {product} on {device}, I get a message that the activation limit is reached. I removed it from my old computer first. Please reset my activations." },
    { subject: "Product still in trial mode", body: "I entered my key {key} but {product} still shows as a trial with 3 days left. What do I need to do to activate the full version?" },
    { subject: "Volume license for {seats} seats", body: "We bought a volume license for {seats} seats of {product}. Only one machine activates with key {key}. How do we activate the other seats?" },
    { subject: "Key not received after purchase", body: "I paid for {product} with order {order} but I did not get a license key by email. I checked my spam folder. Please send the key again." },
    { subject: "Activation fails with error 0x41", body: "Activation of {product} on {device} fails with error 0x41. I have a stable internet connection. My key is {key}." },
    { subject: "Moving license to a new computer", body: "I replaced {device} and want to move my {product} license to it. How do I deactivate the old installation? My order number is {order}." },
    { subject: "Upgrade key does not work", body: "I bought the upgrade from the previous version of {product}. The upgrade key {key} is rejected. Do I need to enter my old key first?" },
    { subject: "Offline activation request", body: "Our office computers have no internet access for security reasons. Can you send instructions for offline activation of {product}? Key: {key}." },
  ],
  download_install: [
    { subject: "Download link expired", body: "The download link in my order email for {product} has expired. Order {order}. Can you send me a new link?" },
    { subject: "Installer stops at 80%", body: "The {product} installer stops at 80% on {device} and then closes without an error. I tried twice and restarted the computer." },
    { subject: "Which installer do I need?", body: "I am not sure which installer of {product} I should use on {device}. There are 32-bit and 64-bit files. Which one is right for me?" },
    { subject: "Download is very slow", body: "The download of {product} is very slow and has been running for over an hour. Is there a mirror or an offline installer I can use?" },
    { subject: "Installation error 1603", body: "Installing {product} on {device} fails with error 1603. I am logged in as an administrator. What should I try next?" },
    { subject: "Program will not start after install", body: "{product} installed without errors, but it does not open. I click the icon and nothing happens. This is on {device}." },
    { subject: "Antivirus blocks the installer", body: "My security software blocks the {product} installer and says the file is unknown. Is the file safe, and how do I install it?" },
    { subject: "Need the previous version", body: "The new version of {product} does not work with our file templates. Can I get the installer for the previous version? Order {order}." },
    { subject: "Install on {seats} computers", body: "We need to install {product} on {seats} computers. Is there a silent installer or a deployment package for IT teams?" },
  ],
  billing: [
    { subject: "Charged twice for one order", body: "My card was charged twice for order {order}. The amount was {amount} each time. Please refund the double charge." },
    { subject: "Need a VAT invoice", body: "Please send an invoice for order {order} with our company VAT number. We need it for our accounts." },
    { subject: "Wrong currency on invoice", body: "The invoice for order {order} shows the wrong currency. We are based in the EU and expected euros." },
    { subject: "Subscription renewed without notice", body: "My {product} subscription renewed automatically for {amount}. I did not get a reminder email first. Can you explain this charge?" },
    { subject: "Payment failed but money taken", body: "The checkout page said my payment failed, but {amount} was taken from my account. I do not have a license. Order {order}." },
    { subject: "Change billing address", body: "We moved offices. Please update the billing address on our account and reissue the invoice for order {order}." },
    { subject: "Price differs from website", body: "The website showed {product} for a lower price than I paid. I was charged {amount}. Can you check order {order}?" },
    { subject: "Cancel automatic renewal", body: "Please turn off automatic renewal for my {product} subscription. I want to decide myself next year." },
    { subject: "Quote for {seats} licenses", body: "We want to buy {seats} licenses of {product}. Can you send a quote with volume pricing and payment terms?" },
  ],
  refund: [
    { subject: "Refund request: bought by mistake", body: "I bought {product} by mistake. I have not activated it. Please refund order {order}." },
    { subject: "Refund: software does not meet needs", body: "{product} does not do what I need for my work. I bought it 5 days ago. I would like a refund for order {order}." },
    { subject: "Duplicate purchase refund", body: "I bought {product} twice by accident. Please refund one of the orders. The second order is {order}." },
    { subject: "Refund after failed activation", body: "I could not activate {product} even after following your guide. I would like my money back. Order {order}, amount {amount}." },
    { subject: "Refund status question", body: "I asked for a refund for order {order} last week. I have not received the money yet. When will it arrive?" },
    { subject: "Partial refund for unused seats", body: "We bought {seats} seats of {product} but only use half of them. Can we get a partial refund? Order {order}." },
    { subject: "Withdraw from purchase", body: "I want to use my right to withdraw from the purchase of {product}, order {order}. Please confirm the refund." },
    { subject: "Refund for wrong edition", body: "I bought the wrong edition of {product}. Can you refund it, or swap it for the business edition? Order {order}." },
  ],
  account_access: [
    { subject: "Cannot log in to my account", body: "I cannot log in to my customer account. The password reset email never arrives. My email address has not changed." },
    { subject: "Two-step code not working", body: "The two-step verification code is always rejected when I log in. I lost my old phone. How do I get back into my account?" },
    { subject: "Change account email address", body: "I left my old company and need to move my licenses to a new email address. How do I change the account email?" },
    { subject: "Account locked", body: "My account is locked after too many login attempts. I need access to download {product} again." },
    { subject: "Add a colleague to our account", body: "Please add a colleague as an admin on our company account so they can manage our {seats} licenses." },
    { subject: "Suspicious login email", body: "I got an email about a login to my account that I did not make. Can you check my account and secure it?" },
    { subject: "Remove a former employee", body: "A former employee still has admin access to our account. Please remove their access as soon as possible." },
    { subject: "Merge two accounts", body: "I have two customer accounts with different email addresses. Can you merge them so all my licenses are in one place?" },
  ],
  other: [
    { subject: "Feature question", body: "Does {product} support exporting to the open document format? I want to check before I buy." },
    { subject: "Education discount", body: "Do you offer a discount for schools? We want to buy {seats} licenses of {product} for our students." },
    { subject: "System requirements", body: "What are the minimum system requirements for {product}? I want to use it on an older computer." },
    { subject: "Feedback on new version", body: "I like the new version of {product}, but the menu layout changed a lot. Is there a way to get the old layout back?" },
    { subject: "Partner program question", body: "We are an IT reseller in the Netherlands. How can we join your partner program to sell {product}?" },
    { subject: "Data privacy question", body: "Where is my data stored when I use the cloud sync in {product}? We need this for our privacy review." },
    { subject: "Request for a user guide", body: "Is there a printable user guide for {product}? Some of our staff prefer paper manuals." },
    { subject: "Compatibility with other tools", body: "Can {product} open files from our old document software? We have many archived files." },
  ],
};

/** Impact sentences that match trigger 2 (Urgent keywords). */
export const URGENT_SENTENCES = [
  "Our license server is down and nobody can open the program.",
  "We have an outage and the whole team is blocked.",
  "My whole team cannot work until this is fixed.",
  "This is an outage for our office. Please help quickly.",
];

export const CSAT_COMMENTS = {
  good: ["Quick and clear help, thank you.", "Problem solved on the first reply.", "Friendly and helpful agent.", "Thanks for the fast fix."],
  bad: ["It took too long to get an answer.", "I had to explain my problem twice.", "The first answer did not solve my issue.", "Nobody replied for days."],
};
