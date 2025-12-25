# PropertyFinder Agent Scraper

<p>
  <strong>Extract real estate agent profiles from PropertyFinder.ae</strong> – the UAE's premier property portal. Efficiently gather comprehensive agent information including contact details, active listings, specializations, company affiliations, and performance metrics.
</p>

<p>
  PropertyFinder.ae hosts thousands of verified real estate agents across the UAE, Dubai, Abu Dhabi, and beyond. This Actor helps you build lead databases, analyze market competition, identify top-performing agents, and connect with property professionals efficiently.
</p>

## Why extract agent data from PropertyFinder.ae?

<ul>
  <li><strong>Lead Generation</strong> – Build targeted databases of real estate professionals for B2B outreach</li>
  <li><strong>Market Intelligence</strong> – Analyze agent distribution, specializations, and market presence across UAE regions</li>
  <li><strong>Competitive Analysis</strong> – Identify top agents by listings count, ratings, and client reviews</li>
  <li><strong>Partnership Opportunities</strong> – Find agents specializing in specific property types or locations</li>
  <li><strong>Recruitment</strong> – Source experienced real estate professionals for hiring opportunities</li>
  <li><strong>Service Provider Targeting</strong> – Connect with agents for real estate services, training, or technology solutions</li>
</ul>

## What data can you extract?

This Actor collects comprehensive agent profile information:

<table>
  <thead>
    <tr>
      <th>Data Field</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Contact Information</strong></td>
      <td>Name, phone number, email address, WhatsApp number</td>
    </tr>
    <tr>
      <td><strong>Profile Details</strong></td>
      <td>Profile photo, biography, professional experience (years), nationality</td>
    </tr>
    <tr>
      <td><strong>Company Information</strong></td>
      <td>Agency name, company logo, broker permit number/RERA license</td>
    </tr>
    <tr>
      <td><strong>Performance Metrics</strong></td>
      <td>Total listings count, active listings, average rating, review count</td>
    </tr>
    <tr>
      <td><strong>Professional Details</strong></td>
      <td>Languages spoken, property specializations, service areas, verification status</td>
    </tr>
    <tr>
      <td><strong>Activity Data</strong></td>
      <td>Last active timestamp, profile URL, agent ID</td>
    </tr>
  </tbody>
</table>

## How it works

<ol>
  <li><strong>HTTP-First Architecture</strong> – Uses fast HTTP requests with CheerioCrawler for optimal performance and cost-efficiency</li>
  <li><strong>Multi-Strategy Extraction</strong> – Attempts JSON data extraction first, falls back to robust HTML parsing with multiple selector strategies</li>
  <li><strong>Smart Pagination</strong> – Automatically traverses search result pages until reaching your specified limits</li>
  <li><strong>Detail Page Collection</strong> – Optionally visits individual agent profiles for comprehensive information</li>
  <li><strong>Deduplication</strong> – Prevents duplicate agent profiles in results</li>
  <li><strong>Proxy Support</strong> – Includes residential proxy configuration for reliable, uninterrupted scraping</li>
</ol>

## Input configuration

Configure the scraper with these parameters:

### Search Filters

<table>
  <thead>
    <tr>
      <th>Parameter</th>
      <th>Type</th>
      <th>Description</th>
      <th>Example</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>startUrl</code></td>
      <td>String</td>
      <td>Direct PropertyFinder agent search URL (overrides other filters)</td>
      <td>https://www.propertyfinder.ae/en/find-agent/search</td>
    </tr>
    <tr>
      <td><code>location</code></td>
      <td>String</td>
      <td>Filter agents by location/area</td>
      <td>Dubai, Abu Dhabi, Downtown Dubai</td>
    </tr>
    <tr>
      <td><code>language</code></td>
      <td>String</td>
      <td>Filter by spoken language</td>
      <td>english, arabic, hindi, french, russian</td>
    </tr>
    <tr>
      <td><code>specialization</code></td>
      <td>String</td>
      <td>Filter by property specialization</td>
      <td>residential, commercial, luxury, investment</td>
    </tr>
  </tbody>
</table>

### Scraping Controls

<table>
  <thead>
    <tr>
      <th>Parameter</th>
      <th>Type</th>
      <th>Description</th>
      <th>Default</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>results_wanted</code></td>
      <td>Integer</td>
      <td>Maximum agent profiles to extract</td>
      <td>100</td>
    </tr>
    <tr>
      <td><code>max_pages</code></td>
      <td>Integer</td>
      <td>Maximum search result pages to process</td>
      <td>20</td>
    </tr>
    <tr>
      <td><code>collectDetails</code></td>
      <td>Boolean</td>
      <td>Visit individual profile pages for complete data</td>
      <td>true</td>
    </tr>
    <tr>
      <td><code>proxyConfiguration</code></td>
      <td>Object</td>
      <td>Proxy settings (Residential recommended)</td>
      <td>Apify Proxy</td>
    </tr>
  </tbody>
</table>

## Usage examples

### Basic Search - Extract Agents from Dubai

```json
{
  "location": "Dubai",
  "results_wanted": 100,
  "collectDetails": true,
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

### Advanced Filtering - Luxury Property Specialists

```json
{
  "location": "Dubai Marina",
  "specialization": "luxury",
  "language": "english",
  "results_wanted": 50,
  "max_pages": 10,
  "collectDetails": true,
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

### Custom URL - Specific Search Criteria

```json
{
  "startUrl": "https://www.propertyfinder.ae/en/find-agent/search?page=1",
  "results_wanted": 200,
  "max_pages": 30,
  "collectDetails": true,
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

### Fast Overview - List Only

```json
{
  "location": "Abu Dhabi",
  "results_wanted": 500,
  "collectDetails": false,
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

## Output format

The Actor saves agent data to the dataset in this structure:

```json
{
  "name": "Ahmed Hassan",
  "email": "ahmed@example.ae",
  "phone": "+971-50-123-4567",
  "whatsapp": "971501234567",
  "agentId": "ag-12345",
  "profileUrl": "https://www.propertyfinder.ae/en/agent/ahmed-hassan",
  "company": "Prestige Real Estate",
  "companyLogo": "https://...logo.jpg",
  "profileImage": "https://...profile.jpg",
  "location": "Dubai Marina",
  "totalListings": 156,
  "activeListings": 142,
  "verified": true,
  "languages": ["English", "Arabic", "Hindi"],
  "nationality": "UAE",
  "experience": 8,
  "specializations": ["Residential", "Luxury Properties"],
  "rating": 4.8,
  "reviewsCount": 234,
  "brokerPermitNo": "BRK-12345-R",
  "lastActive": "2 hours ago",
  "description": "Experienced real estate professional specializing in luxury..."
}
```

### Dataset Fields

<table>
  <thead>
    <tr>
      <th>Field</th>
      <th>Type</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>name</code></td>
      <td>String</td>
      <td>Agent's full name</td>
    </tr>
    <tr>
      <td><code>email</code></td>
      <td>String</td>
      <td>Contact email address</td>
    </tr>
    <tr>
      <td><code>phone</code></td>
      <td>String</td>
      <td>Phone number</td>
    </tr>
    <tr>
      <td><code>whatsapp</code></td>
      <td>String</td>
      <td>WhatsApp contact number</td>
    </tr>
    <tr>
      <td><code>company</code></td>
      <td>String</td>
      <td>Real estate agency/company name</td>
    </tr>
    <tr>
      <td><code>location</code></td>
      <td>String</td>
      <td>Primary service location/area</td>
    </tr>
    <tr>
      <td><code>totalListings</code></td>
      <td>Integer</td>
      <td>Total number of property listings</td>
    </tr>
    <tr>
      <td><code>activeListings</code></td>
      <td>Integer</td>
      <td>Currently active listings</td>
    </tr>
    <tr>
      <td><code>rating</code></td>
      <td>Number</td>
      <td>Average client rating (out of 5)</td>
    </tr>
    <tr>
      <td><code>reviewsCount</code></td>
      <td>Integer</td>
      <td>Number of client reviews</td>
    </tr>
    <tr>
      <td><code>experience</code></td>
      <td>Integer</td>
      <td>Years of professional experience</td>
    </tr>
    <tr>
      <td><code>languages</code></td>
      <td>Array</td>
      <td>Languages spoken by the agent</td>
    </tr>
    <tr>
      <td><code>specializations</code></td>
      <td>Array</td>
      <td>Property type specializations</td>
    </tr>
    <tr>
      <td><code>verified</code></td>
      <td>Boolean</td>
      <td>Verification status on PropertyFinder</td>
    </tr>
    <tr>
      <td><code>brokerPermitNo</code></td>
      <td>String</td>
      <td>RERA/Broker license number</td>
    </tr>
    <tr>
      <td><code>profileUrl</code></td>
      <td>String</td>
      <td>Direct link to agent profile page</td>
    </tr>
  </tbody>
</table>

## Performance and optimization

### Proxy configuration

<blockquote>
  <strong>Important:</strong> Use residential proxies for reliable scraping and to avoid IP blocks.
</blockquote>

Recommended proxy configuration:

```json
{
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

### Best practices

<ul>
  <li><strong>Start Small</strong> – Begin with 50-100 agents to test configuration</li>
  <li><strong>Enable Details Wisely</strong> – Set <code>collectDetails: false</code> for faster basic scraping</li>
  <li><strong>Use Filters</strong> – Apply location and language filters to target specific agents</li>
  <li><strong>Monitor Performance</strong> – Track compute units and runtime in Apify Console</li>
  <li><strong>Schedule Regular Runs</strong> – Use Apify Scheduler for periodic data updates</li>
</ul>

### Resource consumption

<table>
  <thead>
    <tr>
      <th>Agent Profiles</th>
      <th>Runtime</th>
      <th>Compute Units (approx)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>100</td>
      <td>2-4 min</td>
      <td>0.03-0.06</td>
    </tr>
    <tr>
      <td>500</td>
      <td>10-15 min</td>
      <td>0.15-0.25</td>
    </tr>
    <tr>
      <td>1000</td>
      <td>20-30 min</td>
      <td>0.30-0.50</td>
    </tr>
  </tbody>
</table>

<p><em>Note: Times vary based on <code>collectDetails</code> setting, network conditions, and proxy speed.</em></p>

## Use cases

### Lead generation and sales

Build targeted databases for business development:

<ul>
  <li>Generate B2B leads for real estate technology solutions</li>
  <li>Identify agents for partnership opportunities</li>
  <li>Create mailing lists for marketing campaigns</li>
  <li>Find agents by specialization for referrals</li>
</ul>

### Market intelligence

Analyze the real estate agent landscape:

<ul>
  <li>Map agent distribution across UAE regions</li>
  <li>Identify market leaders by listings and ratings</li>
  <li>Analyze specialization trends and gaps</li>
  <li>Track agent activity and market dynamics</li>
</ul>

### Recruitment and talent acquisition

Source experienced real estate professionals:

<ul>
  <li>Find top-performing agents for hiring</li>
  <li>Analyze experience levels and specializations</li>
  <li>Identify multilingual talent for international markets</li>
  <li>Build candidate databases for recruitment</li>
</ul>

### Competitive analysis

Understand your competition:

<ul>
  <li>Monitor competitor agency agent counts</li>
  <li>Analyze agent ratings and client satisfaction</li>
  <li>Track new agent entries to the market</li>
  <li>Benchmark performance metrics</li>
</ul>

## Integration and export

### Export formats

Export your scraped data in multiple formats:

<ul>
  <li><strong>JSON</strong> – Structured data for APIs and applications</li>
  <li><strong>CSV</strong> – Import into Excel, Google Sheets, or CRM systems</li>
  <li><strong>Excel (XLSX)</strong> – Ready for business analysis</li>
  <li><strong>XML</strong> – For enterprise system integration</li>
  <li><strong>RSS</strong> – Automated feed updates</li>
</ul>

### API access

Access your data programmatically using the Apify API:

```javascript
const { ApifyClient } = require('apify-client');
const client = new ApifyClient({ token: 'YOUR_API_TOKEN' });

// Get dataset items
const { items } = await client
  .dataset('YOUR_DATASET_ID')
  .listItems();

console.log(items);
```

### Webhooks and automation

Configure webhooks to trigger actions when scraping completes:

<ul>
  <li>Send data to CRM systems automatically</li>
  <li>Trigger email notifications</li>
  <li>Update databases in real-time</li>
  <li>Integrate with Zapier, Make, or custom workflows</li>
</ul>

## Compliance and responsible use

<blockquote>
  <strong>Legal Notice:</strong> This Actor is provided for legitimate business purposes. Users must comply with PropertyFinder.ae's Terms of Service, UAE data protection laws, and all applicable regulations.
</blockquote>

### Responsible scraping guidelines

<ul>
  <li>Use reasonable rate limits to avoid server overload</li>
  <li>Respect robots.txt and website policies</li>
  <li>Handle personal data in compliance with privacy laws</li>
  <li>Use scraped data for lawful purposes only</li>
  <li>Do not redistribute or resell the data without permission</li>
  <li>Respect intellectual property and copyright</li>
</ul>

### Data privacy considerations

When handling agent contact information:

<ul>
  <li>Store data securely with appropriate access controls</li>
  <li>Use data only for intended business purposes</li>
  <li>Comply with GDPR, UAE data protection laws, and privacy regulations</li>
  <li>Provide opt-out mechanisms for marketing communications</li>
  <li>Delete data when no longer needed</li>
</ul>

## Troubleshooting

### Common issues and solutions

<dl>
  <dt><strong>No agents returned</strong></dt>
  <dd>
    <ul>
      <li>Verify search parameters (location, language, specialization)</li>
      <li>Check if location name matches PropertyFinder format</li>
      <li>Try using <code>startUrl</code> with a known working search URL</li>
      <li>Ensure proxies are properly configured</li>
    </ul>
  </dd>

  <dt><strong>Blocked or rate limited</strong></dt>
  <dd>
    <ul>
      <li>Enable Residential proxies in configuration</li>
      <li>Reduce <code>maxConcurrency</code> in advanced settings</li>
      <li>Add delays between requests</li>
      <li>Verify proxy group has available IPs</li>
    </ul>
  </dd>

  <dt><strong>Missing contact information</strong></dt>
  <dd>
    <ul>
      <li>Enable <code>collectDetails</code> to visit profile pages</li>
      <li>Some agents may not display all contact methods publicly</li>
      <li>Check if website structure has changed</li>
    </ul>
  </dd>

  <dt><strong>Run timeout or crashes</strong></dt>
  <dd>
    <ul>
      <li>Reduce <code>results_wanted</code> to process fewer agents per run</li>
      <li>Decrease <code>max_pages</code> limit</li>
      <li>Increase memory allocation in Actor settings</li>
      <li>Check Actor logs for specific error messages</li>
    </ul>
  </dd>
</dl>

## Support and resources

### Getting help

Need assistance? We're here to help:

<ul>
  <li>Check the <a href="https://docs.apify.com">Apify Documentation</a> for platform guides</li>
  <li>Visit the <a href="https://community.apify.com">Apify Community Forum</a> for discussions</li>
  <li>Contact support through the Apify Console</li>
  <li>Review Actor logs for detailed error information</li>
</ul>

### Additional resources

<ul>
  <li><a href="https://docs.apify.com/tutorials">Apify Tutorials</a> – Learn web scraping fundamentals</li>
  <li><a href="https://docs.apify.com/academy">Apify Academy</a> – Advanced scraping techniques</li>
  <li><a href="https://docs.apify.com/api/v2">Apify API Reference</a> – Integrate with your applications</li>
</ul>

### Related Actors

Explore other real estate data extraction solutions:

<ul>
  <li><strong>Bayut Agent Scraper</strong> – Extract agent data from Bayut.com</li>
  <li><strong>Dubizzle Real Estate Scraper</strong> – Dubai classified listings and agents</li>
  <li><strong>Zillow Agent Scraper</strong> – US real estate agent profiles</li>
</ul>

## Technical details

### Architecture

This Actor uses a modern, efficient scraping approach:

<ul>
  <li><strong>HTTP-First Design</strong> – CheerioCrawler for fast, cost-effective scraping</li>
  <li><strong>Multi-Strategy Extraction</strong> – JSON data parsing with HTML fallback</li>
  <li><strong>Smart Selectors</strong> – Multiple selector strategies for robustness</li>
  <li><strong>Concurrent Processing</strong> – Parallel request handling for speed</li>
  <li><strong>Built-in Retry Logic</strong> – Automatic retries for failed requests</li>
</ul>

### Data extraction methods

<ol>
  <li><strong>JSON Priority</strong> – Attempts to extract structured JSON data from page source</li>
  <li><strong>HTML Fallback</strong> – Uses semantic HTML selectors when JSON unavailable</li>
  <li><strong>JSON-LD Support</strong> – Parses structured data markup when present</li>
  <li><strong>Hybrid Approach</strong> – Combines multiple methods for maximum data completeness</li>
</ol>

### Key features

<ul>
  <li>Extracts data from agent listing pages and individual profiles</li>
  <li>Supports pagination for large result sets</li>
  <li>Automatic deduplication of agent profiles</li>
  <li>Configurable detail collection for speed/completeness trade-offs</li>
  <li>Residential proxy support for reliability</li>
  <li>Structured JSON output with comprehensive agent information</li>
</ul>

## Changelog

### Version 1.0.0 (Latest)

<ul>
  <li>Initial release of PropertyFinder Agent Scraper</li>
  <li>Agent profile extraction from PropertyFinder.ae</li>
  <li>Support for location, language, and specialization filtering</li>
  <li>Detailed profile collection with contact information</li>
  <li>Multi-strategy data extraction (JSON + HTML parsing)</li>
  <li>Pagination support with configurable limits</li>
  <li>Residential proxy configuration for reliable scraping</li>
  <li>Comprehensive output schema with 15+ data fields</li>
</ul>

## About PropertyFinder.ae

PropertyFinder.ae is the UAE's leading online real estate portal, connecting property seekers with real estate professionals. The platform hosts thousands of verified agents representing properties across Dubai, Abu Dhabi, Sharjah, and other Emirates. Agents on PropertyFinder manage residential, commercial, and luxury property portfolios, offering comprehensive real estate services to buyers, sellers, renters, and investors.

## Keywords

real estate agents UAE, PropertyFinder scraper, agent leads Dubai, real estate data extraction, property agent database, UAE agent scraper, Dubai real estate agents, agent contact scraper, real estate lead generation, agent profile extractor, PropertyFinder data, real estate automation, agent finder tool, property professional scraper, UAE real estate data, B2B lead generation, real estate professionals UAE, agent directory scraper

---

<p align="center">
  <strong>Need help or have questions?</strong><br>
  Visit the <a href="https://community.apify.com">Apify Community Forum</a> or contact support through the Apify Console.
</p>

<p align="center">
  <em>For custom real estate data solutions and enterprise support, explore Apify's professional services.</em>
</p>
