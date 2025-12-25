// PropertyFinder.ae Agent Scraper - Production-Ready Optimized Version
import { Actor, log } from 'apify';
import { CheerioCrawler, gotScraping } from 'crawlee';
import { load } from 'cheerio';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const cleanText = (text) => {
    if (!text) return null;
    const cleaned = String(text).replace(/\s+/g, ' ').trim();
    return cleaned.length ? cleaned : null;
};

const toAbsoluteUrl = (href, base = 'https://www.propertyfinder.ae') => {
    if (!href) return null;
    try {
        if (href.startsWith('http')) return href;
        if (href.startsWith('//')) return 'https:' + href;
        return new URL(href, base).href;
    } catch {
        return null;
    }
};

const numberFromText = (text) => {
    if (!text) return null;
    const match = String(text).replace(/,/g, '').match(/[\d.]+/);
    return match ? Number(match[0]) : null;
};

const randomDelay = (min = 500, max = 2000) => {
    return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
};

// ============================================================================
// URL BUILDERS
// ============================================================================

const buildSearchUrl = ({ startUrl, location, language, specialization, page = 1 }) => {
    if (startUrl) {
        const url = new URL(startUrl);
        url.searchParams.set('page', String(page));
        return url.href;
    }

    const url = new URL('https://www.propertyfinder.ae/en/find-agent/search');
    url.searchParams.set('page', String(page));

    if (location) url.searchParams.set('l', location);
    if (language) url.searchParams.set('language', language);
    if (specialization) url.searchParams.set('specialization', specialization);

    return url.href;
};

// ============================================================================
// STEALTH HEADERS
// ============================================================================

const getStealthHeaders = (referer = 'https://www.propertyfinder.ae/en/find-agent/search') => ({
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9,ar;q=0.8',
    'accept-encoding': 'gzip, deflate, br',
    'cache-control': 'max-age=0',
    'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'referer': referer,
    'dnt': '1',
});

// ============================================================================
// PRIORITY 1: __NEXT_DATA__ EXTRACTION (PRIMARY METHOD)
// ============================================================================

const extractNextData = (html) => {
    try {
        const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
        if (!match) {
            log.debug('__NEXT_DATA__ script tag not found');
            return null;
        }

        const data = JSON.parse(match[1]);
        log.debug('✓ Parsed __NEXT_DATA__', { hasProps: !!data?.props });

        const pageProps = data?.props?.pageProps;
        if (!pageProps) {
            log.debug('No pageProps in __NEXT_DATA__');
            return null;
        }

        // Check all possible data locations for agents/brokers
        const agents = pageProps.brokers || pageProps.agents ||
            pageProps.searchResult?.brokers || pageProps.searchResult?.agents ||
            pageProps.data?.brokers || pageProps.data?.agents ||
            pageProps.initialData?.brokers || pageProps.initialData?.agents ||
            pageProps.serverState?.brokers || pageProps.serverState?.agents ||
            pageProps.broker || pageProps.agent;

        // Handle single agent (detail page) vs array (listing page)
        const agentArray = Array.isArray(agents) ? agents : (agents ? [agents] : null);

        if (!agentArray || agentArray.length === 0) {
            log.debug('No agents in __NEXT_DATA__', {
                availableKeys: Object.keys(pageProps).slice(0, 10).join(', ')
            });
            return null;
        }

        log.info(`✓ __NEXT_DATA__ extraction successful: ${agentArray.length} agents found`);
        return parseNextDataAgents(agentArray);

    } catch (err) {
        log.warning('__NEXT_DATA__ extraction failed', { error: err.message, stack: err.stack });
        return null;
    }
};

const parseNextDataAgents = (agents) => {
    return agents.map(agent => {
        try {
            // Build profile URL from slug or id
            const slug = agent.slug || agent.name?.toLowerCase().replace(/\s+/g, '-');
            const agentId = agent.id || agent.agent_id || agent.broker_id;
            const profileUrl = agent.url || agent.profile_url || agent.href ||
                (slug && agentId ? `https://www.propertyfinder.ae/en/agent/${slug}-${agentId}` : null);

            // Extract transaction data
            const transactions = [];
            if (Array.isArray(agent.claimedTransactionsList)) {
                agent.claimedTransactionsList.forEach(tx => {
                    transactions.push({
                        propertyType: tx.propertyType || tx.property_type,
                        location: tx.location?.name || tx.location,
                        dealType: tx.dealType || tx.deal_type, // Sale/Rent
                        price: tx.price,
                        date: tx.date || tx.transactionDate || tx.transaction_date,
                    });
                });
            }

            return {
                // Basic Info
                name: agent.name || agent.full_name || agent.display_name ||
                    (agent.first_name && agent.last_name ? `${agent.first_name} ${agent.last_name}` : null),
                agentId: String(agentId || ''),
                profileUrl: toAbsoluteUrl(profileUrl),

                // Contact Information
                email: agent.email || agent.contact?.email || agent.email_address,
                phone: agent.phone || agent.mobile || agent.contact_number || agent.contact?.phone || agent.telephone,
                whatsapp: agent.whatsapp || agent.whatsappNumber || agent.whatsapp_number || agent.contact?.whatsapp,

                // Professional Details
                position: agent.position || agent.jobTitle || agent.job_title || agent.role,
                company: agent.broker?.name || agent.company?.name || agent.agency_name || agent.broker_name || agent.agency,
                companyId: agent.broker?.id || agent.company?.id || agent.broker_id,
                companyLogo: toAbsoluteUrl(agent.broker?.logo || agent.company?.logo || agent.broker_logo || agent.company_logo),
                companyAddress: agent.broker?.address || agent.company?.address || agent.office_address,

                // Personal Details
                profileImage: toAbsoluteUrl(agent.image || agent.photo || agent.avatar || agent.profile_image || agent.picture),
                nationality: agent.nationality?.name || agent.nationality || agent.country,
                languages: Array.isArray(agent.languages) ? agent.languages :
                    (agent.languages ? String(agent.languages).split(',').map(l => l.trim()) : null),

                // Location & Areas
                location: agent.location?.name || agent.city || agent.area || agent.location || agent.region,

                // Performance Metrics
                totalListings: agent.total_listings || agent.totalActiveProperties || agent.property_count ||
                    agent.listings_count || agent.properties_count || agent.listing_count,
                activeListings: agent.active_listings || agent.activeListings || agent.active_properties || agent.active_count,
                rentListings: agent.rentListings || agent.propertiesForRent || agent.rent_count,
                saleListings: agent.saleListings || agent.propertiesForSale || agent.sale_count,

                // Ratings & Reviews
                rating: agent.rating || agent.average_rating || agent.score || agent.stars,
                reviewsCount: agent.reviews_count || agent.reviewsCount || agent.total_reviews || agent.review_count || agent.reviews,
                ranking: agent.ranking || agent.rank || agent.position_rank,

                // Experience & Credentials
                experience: agent.experience_years || agent.yearsOfExperience || agent.years_of_experience ||
                    agent.experience || agent.years,
                brokerPermitNo: agent.broker_permit_no || agent.licenseNumber || agent.license_number ||
                    agent.rera_permit || agent.permit_number || agent.license || agent.registration_no || agent.brn,

                // Additional Info
                verified: agent.verified || agent.is_verified || agent.is_active || false,
                description: agent.description || agent.bio || agent.about || agent.summary,
                specializations: Array.isArray(agent.specializations) ? agent.specializations :
                    Array.isArray(agent.property_types) ? agent.property_types :
                        (agent.specialization ? [agent.specialization] : null),

                // Activity & Status
                lastActive: agent.last_active || agent.lastActive || agent.last_seen || agent.updated_at || agent.last_online,

                // Transaction Data
                transactionHistory: transactions.length > 0 ? transactions : null,
                totalDealVolume: agent.claimedTransactionsDealVolume || agent.total_deal_volume || agent.deal_volume,
                totalTransactions: agent.claimedTransactionsCount || transactions.length || null,
            };
        } catch (err) {
            log.debug('Failed to parse agent from __NEXT_DATA__', { error: err.message });
            return null;
        }
    }).filter(agent => agent && (agent.profileUrl || agent.name));
};

// ============================================================================
// PRIORITY 2: JSON-LD EXTRACTION (SECONDARY/ENRICHMENT)
// ============================================================================

const extractJsonLd = ($) => {
    try {
        const scripts = $('script[type="application/ld+json"]').toArray();
        for (const script of scripts) {
            const content = $(script).contents().text();
            if (!content) continue;

            try {
                const parsed = JSON.parse(content);
                const data = Array.isArray(parsed) ? parsed[0] : parsed;

                if (data['@type'] && /Person|RealEstateAgent|Agent|Broker/i.test(data['@type'])) {
                    log.debug('✓ Found JSON-LD agent data');
                    return {
                        name: data.name,
                        email: data.email,
                        phone: data.telephone || data.phone,
                        profileUrl: data.url,
                        company: data.worksFor?.name || data.affiliation?.name,
                        location: data.address?.addressLocality || data.workLocation,
                        description: data.description,
                        position: data.jobTitle,
                        nationality: data.nationality?.name,
                        profileImage: toAbsoluteUrl(data.image),
                    };
                }
            } catch {
                continue;
            }
        }
    } catch (err) {
        log.debug('JSON-LD extraction failed', { error: err.message });
    }
    return {};
};

// ============================================================================
// PRIORITY 3: HTML PARSING (FALLBACK ONLY)
// ============================================================================

const extractAgentCards = ($) => {
    const cards = [];
    log.debug('Attempting HTML card extraction (fallback mode)');

    // Strategy 1: Data-testid selectors (most reliable)
    const testIdSelectors = [
        'article[data-testid*="agent"]',
        'div[data-testid*="agent"]',
        '[data-testid*="broker"]',
        '[data-testid*="agent-card"]'
    ];

    testIdSelectors.forEach(selector => {
        $(selector).each((_, el) => {
            const agent = extractAgentFromCard($, $(el));
            if (agent) cards.push(agent);
        });
    });

    if (cards.length > 0) {
        log.info(`✓ HTML extraction (data-testid): ${cards.length} agents`);
        return cards;
    }

    // Strategy 2: Class-based selectors
    const classSelectors = [
        'article[class*="agent"]',
        'div[class*="AgentCard"]',
        'div[class*="agent-card"]',
        'div[class*="broker-card"]',
        '[class*="BrokerCard"]'
    ];

    classSelectors.forEach(selector => {
        $(selector).each((_, el) => {
            const agent = extractAgentFromCard($, $(el));
            if (agent) cards.push(agent);
        });
    });

    if (cards.length > 0) {
        log.info(`✓ HTML extraction (class-based): ${cards.length} agents`);
        return cards;
    }

    // Strategy 3: Semantic HTML (last resort)
    $('article, div[class*="card"]').each((_, el) => {
        const card = $(el);
        const hasAgentLink = card.find('a[href*="/agent/"], a[href*="/broker/"]').length > 0;
        if (hasAgentLink) {
            const agent = extractAgentFromCard($, card);
            if (agent) cards.push(agent);
        }
    });

    if (cards.length > 0) {
        log.info(`✓ HTML extraction (semantic): ${cards.length} agents`);
    } else {
        log.warning('⚠️ No agent cards found via HTML parsing');
    }

    return cards;
};

const extractAgentFromCard = ($, card) => {
    try {
        // Find profile URL (required)
        const link = card.find('a[href*="/agent/"], a[href*="/broker/"]').first().attr('href');
        const profileUrl = toAbsoluteUrl(link);
        if (!profileUrl) return null;

        const name = cleanText(
            card.find('[data-testid*="name"], [class*="name"], h2, h3, h4').first().text()
        );

        if (!name || name.length < 2) return null;

        return {
            name,
            profileUrl,
            email: cleanText(
                card.find('[data-testid*="email"], [class*="email"], a[href^="mailto:"]').first().text() ||
                card.find('a[href^="mailto:"]').first().attr('href')?.replace('mailto:', '')
            ),
            phone: cleanText(
                card.find('[data-testid*="phone"], [class*="phone"], a[href^="tel:"]').first().text() ||
                card.find('a[href^="tel:"]').first().attr('href')?.replace('tel:', '')
            ),
            whatsapp: cleanText(
                card.find('[data-testid*="whatsapp"], [class*="whatsapp"]').first().text() ||
                card.find('a[href*="wa.me"], a[href*="whatsapp"]').first().attr('href')?.match(/\d+/)?.[0]
            ),
            company: cleanText(
                card.find('[data-testid*="company"], [class*="company"], [class*="broker"], [class*="agency"]').first().text()
            ),
            profileImage: toAbsoluteUrl(
                card.find('img').first().attr('src') ||
                card.find('img').first().attr('data-src') ||
                card.find('img').first().attr('data-lazy-src')
            ),
            location: cleanText(
                card.find('[data-testid*="location"], [class*="location"], [class*="area"]').first().text()
            ),
            totalListings: numberFromText(
                card.find('[data-testid*="listing"], [class*="listing"], [class*="property"]').first().text()
            ),
            rating: numberFromText(
                card.find('[data-testid*="rating"], [class*="rating"], [class*="stars"]').first().text()
            ),
        };
    } catch (err) {
        log.debug('Failed to extract agent card', { error: err.message });
        return null;
    }
};

// ============================================================================
// DETAIL PAGE EXTRACTION
// ============================================================================

const fetchDetailWithCheerio = async (url, proxyUrl) => {
    try {
        await randomDelay(300, 1000); // Anti-bot delay

        const response = await gotScraping({
            url,
            proxyUrl,
            headers: getStealthHeaders(url),
            timeout: { request: 30000 },
            retry: { limit: 2 },
        });

        const $ = load(response.body);

        // Priority 1: Try __NEXT_DATA__ first (most complete)
        const nextDataAgents = extractNextData(response.body);
        if (nextDataAgents && nextDataAgents.length > 0) {
            log.debug('✓ Detail page: extracted from __NEXT_DATA__');
            return nextDataAgents[0];
        }

        // Priority 2: Extract from JSON-LD
        const jsonLd = extractJsonLd($);

        // Priority 3: Extract from HTML
        const htmlData = extractDetailFromHtml($, url);

        // Merge data sources (JSON-LD enriches HTML data)
        return { ...htmlData, ...jsonLd, profileUrl: url };

    } catch (err) {
        log.warning('Detail fetch failed', { url, error: err.message });
        return null;
    }
};

const extractDetailFromHtml = ($, url) => {
    const name = cleanText(
        $('h1, [data-testid*="agent-name"], [class*="agent-name"]').first().text()
    );

    const email = cleanText(
        $('[data-testid*="email"], [class*="email"], a[href^="mailto:"]').first().text() ||
        $('a[href^="mailto:"]').first().attr('href')?.replace('mailto:', '')
    );

    const phone = cleanText(
        $('[data-testid*="phone"], [class*="phone"], a[href^="tel:"]').first().text() ||
        $('a[href^="tel:"]').first().attr('href')?.replace('tel:', '') ||
        $('meta[itemprop="telephone"]').attr('content')
    );

    const whatsapp = cleanText(
        $('[data-testid*="whatsapp"], [class*="whatsapp"]').first().text() ||
        $('a[href*="wa.me"], a[href*="whatsapp"]').first().attr('href')?.match(/\d+/)?.[0]
    );

    const company = cleanText(
        $('[data-testid*="company"], [class*="company"], [class*="broker"], [class*="agency"]').first().text() ||
        $('meta[property="og:site_name"]').attr('content')
    );

    const location = cleanText(
        $('[data-testid*="location"], [class*="location"], [class*="area"]').first().text() ||
        $('meta[itemprop="address"]').attr('content')
    );

    const profileImage = toAbsoluteUrl(
        $('img[alt*="agent"], img[class*="profile"], img[class*="avatar"]').first().attr('src') ||
        $('meta[property="og:image"]').attr('content')
    );

    const totalListings = numberFromText(
        $('[data-testid*="listing"], [class*="listing-count"], [class*="property-count"]').first().text()
    );

    const description = cleanText(
        $('[data-testid*="bio"], [data-testid*="description"], [class*="bio"], [class*="about"]').text() ||
        $('meta[name="description"]').attr('content')
    );

    const languages = [];
    $('[data-testid*="language"], [class*="language"]').each((_, lang) => {
        const langText = cleanText($(lang).text());
        if (langText) languages.push(langText);
    });

    const specializations = [];
    $('[data-testid*="specialization"], [class*="specialization"], [class*="expertise"]').each((_, spec) => {
        const specText = cleanText($(spec).text());
        if (specText) specializations.push(specText);
    });

    const rating = numberFromText(
        $('[data-testid*="rating"], [class*="rating"]').first().text()
    );

    const reviewsCount = numberFromText(
        $('[data-testid*="review"], [class*="review-count"]').first().text()
    );

    const experience = numberFromText(
        $('[data-testid*="experience"], [class*="experience"], [class*="years"]').first().text()
    );

    const brokerPermitNo = cleanText(
        $('[data-testid*="permit"], [data-testid*="license"], [class*="permit"], [class*="rera"]').first().text()
    );

    return {
        name,
        email,
        phone,
        whatsapp,
        company,
        location,
        profileImage,
        totalListings,
        description,
        languages: languages.length ? languages : null,
        specializations: specializations.length ? specializations : null,
        rating,
        reviewsCount,
        experience,
        brokerPermitNo,
        profileUrl: url,
    };
};

// ============================================================================
// SMART DATA MERGING
// ============================================================================

const mergeAgentData = (listingData, detailData) => {
    if (!detailData) return listingData;

    const merged = { ...listingData };

    // Only overwrite if detail data has a non-null value and listing doesn't
    Object.keys(detailData).forEach(key => {
        if (detailData[key] !== null && detailData[key] !== undefined) {
            // Prefer detail data for these fields
            if (['description', 'experience', 'brokerPermitNo', 'specializations', 'transactionHistory'].includes(key)) {
                merged[key] = detailData[key];
            }
            // For other fields, only fill if listing data is empty
            else if (!merged[key]) {
                merged[key] = detailData[key];
            }
        }
    });

    return merged;
};

// ============================================================================
// DATA COMPLETENESS TRACKING
// ============================================================================

const calculateCompleteness = (agent) => {
    const criticalFields = ['name', 'email', 'phone', 'company', 'profileUrl'];
    const importantFields = ['whatsapp', 'location', 'totalListings', 'rating', 'description'];
    const optionalFields = ['languages', 'specializations', 'experience', 'brokerPermitNo', 'transactionHistory'];

    const allFields = [...criticalFields, ...importantFields, ...optionalFields];
    const filledFields = allFields.filter(field =>
        agent[field] !== null && agent[field] !== undefined && agent[field] !== ''
    );

    return {
        percentage: Math.round((filledFields.length / allFields.length) * 100),
        filled: filledFields.length,
        total: allFields.length,
        hasCritical: criticalFields.every(f => agent[f]),
    };
};

// ============================================================================
// MAIN ACTOR LOGIC
// ============================================================================

await Actor.init();

async function main() {
    const input = (await Actor.getInput()) || {};
    const {
        startUrl,
        location,
        language,
        specialization,
        results_wanted: resultsWantedRaw = 100,
        max_pages: maxPagesRaw = 20,
        collectDetails = true,
        proxyConfiguration,
    } = input;

    log.info('🚀 PropertyFinder Agent Scraper - Production Ready', {
        location,
        language,
        specialization,
        resultsWanted: resultsWantedRaw,
        maxPages: maxPagesRaw,
        collectDetails,
    });

    const RESULTS_WANTED = Number.isFinite(+resultsWantedRaw)
        ? Math.max(1, +resultsWantedRaw)
        : Number.MAX_SAFE_INTEGER;
    const MAX_PAGES = Number.isFinite(+maxPagesRaw) ? Math.max(1, +maxPagesRaw) : 20;

    let proxyConfig;
    let proxyUrl;
    try {
        proxyConfig = await Actor.createProxyConfiguration(proxyConfiguration || {});
        const proxyInfo = await proxyConfig.newProxyInfo();
        proxyUrl = proxyInfo?.url;
        log.info('✓ Proxy configured', { hasProxy: !!proxyUrl });
    } catch (err) {
        log.warning('⚠️ Proxy configuration failed, proceeding without proxy', { error: err.message });
    }

    const seenUrls = new Set();
    const enqueuedPages = new Set();
    let totalSaved = 0;
    let emptyPageCount = 0;
    const stats = {
        pagesProcessed: 0,
        agentsFound: 0,
        dataCompleteness: [],
    };

    const crawler = new CheerioCrawler({
        proxyConfiguration: proxyConfig,
        maxConcurrency: 2, // Reduced for stealth
        minConcurrency: 1,
        maxRequestRetries: 3,
        requestHandlerTimeoutSecs: 120,

        async requestHandler({ $, request, body }) {
            const pageNo = request.userData.pageNo || 1;
            const html = body.toString();

            stats.pagesProcessed++;
            log.info(`📄 Processing page ${pageNo}...`);

            // Add delay between pages for stealth
            if (pageNo > 1) {
                await randomDelay(800, 1500);
            }

            // Priority 1: Try __NEXT_DATA__ extraction (FASTEST & MOST COMPLETE)
            let agents = extractNextData(html);

            // Priority 2: Fallback to HTML parsing (if __NEXT_DATA__ fails)
            if (!agents || agents.length === 0) {
                log.debug('⚠️ __NEXT_DATA__ failed, falling back to HTML parsing');
                agents = extractAgentCards($);
            }

            if (!agents || agents.length === 0) {
                log.warning(`⚠️ No agents found on page ${pageNo}`);
                emptyPageCount++;

                // Stop if 2 consecutive empty pages
                if (emptyPageCount >= 2) {
                    log.info('⛔ Stopping: 2 consecutive empty pages detected');
                    await crawler.autoscaledPool?.abort();
                }
                return;
            }

            // Reset empty page counter
            emptyPageCount = 0;
            stats.agentsFound += agents.length;
            log.info(`✓ Found ${agents.length} agents on page ${pageNo} (Total: ${stats.agentsFound})`);

            for (const agent of agents) {
                if (totalSaved >= RESULTS_WANTED) {
                    log.info(`🎯 Target reached: ${totalSaved}/${RESULTS_WANTED} agents saved`);
                    await crawler.autoscaledPool?.abort();
                    return;
                }

                const agentUrl = agent.profileUrl;
                if (!agentUrl || seenUrls.has(agentUrl)) continue;
                seenUrls.add(agentUrl);

                let finalRecord = { ...agent };

                // Check if we need detail page (skip if listing data is already complete)
                const listingCompleteness = calculateCompleteness(agent);
                const needsDetail = collectDetails && listingCompleteness.percentage < 90;

                if (needsDetail && agentUrl) {
                    try {
                        log.debug(`Fetching detail page: ${agentUrl}`);
                        const detailData = await fetchDetailWithCheerio(agentUrl, proxyUrl);
                        finalRecord = mergeAgentData(agent, detailData);
                    } catch (err) {
                        log.warning('Detail fetch failed, using listing data', {
                            url: agentUrl,
                            error: err.message
                        });
                    }
                }

                // Calculate final completeness
                const completeness = calculateCompleteness(finalRecord);
                stats.dataCompleteness.push(completeness.percentage);

                // Save the agent
                await Actor.pushData(finalRecord);
                totalSaved++;

                log.info(`✓ Saved agent ${totalSaved}/${RESULTS_WANTED}`, {
                    name: finalRecord.name,
                    completeness: `${completeness.percentage}%`,
                    email: finalRecord.email ? '✓' : '✗',
                    phone: finalRecord.phone ? '✓' : '✗',
                });
            }

            // Pagination
            if (pageNo < MAX_PAGES && totalSaved < RESULTS_WANTED) {
                const nextPage = pageNo + 1;
                const nextUrl = buildSearchUrl({
                    startUrl,
                    location,
                    language,
                    specialization,
                    page: nextPage,
                });

                if (!enqueuedPages.has(nextUrl)) {
                    enqueuedPages.add(nextUrl);
                    await crawler.addRequests([{ url: nextUrl, userData: { pageNo: nextPage } }]);
                    log.info(`➡️  Queued page ${nextPage}`);
                }
            }
        },

        failedRequestHandler({ request }, error) {
            log.error('❌ Request failed', {
                url: request.url,
                error: error.message,
                retries: request.retryCount
            });
        },
    });

    const initialUrl = buildSearchUrl({
        startUrl,
        location,
        language,
        specialization,
        page: 1,
    });
    enqueuedPages.add(initialUrl);

    log.info('🌐 Starting crawler', { url: initialUrl });

    await crawler.run([{
        url: initialUrl,
        userData: { pageNo: 1 },
    }]);

    // Final statistics
    const avgCompleteness = stats.dataCompleteness.length > 0
        ? Math.round(stats.dataCompleteness.reduce((a, b) => a + b, 0) / stats.dataCompleteness.length)
        : 0;

    log.info('✅ Scraping completed!', {
        agentsSaved: totalSaved,
        target: RESULTS_WANTED,
        pagesProcessed: stats.pagesProcessed,
        avgDataCompleteness: `${avgCompleteness}%`,
    });
}

main()
    .catch((err) => {
        log.exception(err, '💥 Fatal error occurred');
        process.exit(1);
    })
    .finally(async () => {
        await Actor.exit();
    });
