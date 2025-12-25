// PropertyFinder.ae Agent Scraper - Production-Ready with Multi-Strategy Data Extraction
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

// PropertyFinder internal API patterns to try
const buildApiUrls = ({ location, language, page = 1, limit = 20 }) => {
    const apis = [];
    
    // Pattern 1: /api/brokers endpoint
    const api1 = new URL('https://www.propertyfinder.ae/en/api/brokers');
    api1.searchParams.set('page', String(page));
    api1.searchParams.set('limit', String(limit));
    if (location) api1.searchParams.set('location', location);
    if (language) api1.searchParams.set('language', language);
    apis.push(api1.href);
    
    // Pattern 2: /api/v2/agents endpoint
    const api2 = new URL('https://www.propertyfinder.ae/api/v2/agents');
    api2.searchParams.set('page', String(page));
    api2.searchParams.set('page_size', String(limit));
    if (location) api2.searchParams.set('l', location);
    apis.push(api2.href);
    
    // Pattern 3: GraphQL endpoint (if they use it)
    apis.push('https://www.propertyfinder.ae/graphql');
    
    return apis;
};

// ============================================================================
// PRIORITY 1: INTERNAL API EXTRACTION
// ============================================================================

const fetchFromInternalApi = async (params, proxyUrl) => {
    const apiUrls = buildApiUrls(params);
    
    for (const apiUrl of apiUrls) {
        try {
            log.debug('Trying API endpoint', { apiUrl });
            
            const headers = {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.9',
                'referer': 'https://www.propertyfinder.ae/en/find-agent/search',
                'origin': 'https://www.propertyfinder.ae',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'x-requested-with': 'XMLHttpRequest',
                'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
            };
            
            // Handle GraphQL differently
            if (apiUrl.includes('graphql')) {
                const graphqlQuery = {
                    query: `query GetBrokers($page: Int, $limit: Int, $location: String) {
                        brokers(page: $page, limit: $limit, location: $location) {
                            id name email phone image company { name logo }
                            location totalListings rating verified
                        }
                    }`,
                    variables: {
                        page: params.page || 1,
                        limit: params.limit || 20,
                        location: params.location
                    }
                };
                
                const response = await gotScraping({
                    url: apiUrl,
                    method: 'POST',
                    headers: { ...headers, 'content-type': 'application/json' },
                    json: graphqlQuery,
                    proxyUrl,
                    responseType: 'json',
                    timeout: { request: 30000 },
                    retry: { limit: 0 }
                });
                
                if (response.statusCode === 200 && response.body?.data?.brokers) {
                    log.info('✓ GraphQL API successful', { count: response.body.data.brokers.length });
                    return parseApiAgents(response.body.data.brokers);
                }
            } else {
                // REST API
                const response = await gotScraping({
                    url: apiUrl,
                    method: 'GET',
                    headers,
                    proxyUrl,
                    responseType: 'json',
                    timeout: { request: 30000 },
                    retry: { limit: 0 }
                });

                if (response.statusCode === 200 && response.body) {
                    const data = response.body;
                    
                    // Check various response structures
                    const agents = data.brokers || data.agents || data.data?.brokers || data.data?.agents || 
                                  data.results || data.items || data.list || data.content || [];
                    
                    if (Array.isArray(agents) && agents.length > 0) {
                        log.info('✓ API extraction successful', { endpoint: apiUrl, count: agents.length });
                        return parseApiAgents(agents);
                    }
                }
            }
        } catch (err) {
            log.debug('API attempt failed', { url: apiUrl, error: err.message });
            continue;
        }
    }
    
    log.debug('All API endpoints failed, falling back to HTML parsing');
    return null;
};

const parseApiAgents = (agents) => {
    return agents.map(agent => {
        const agentUrl = agent.url || agent.profile_url || agent.slug || agent.href;
        return {
            name: agent.name || agent.full_name || agent.display_name || 
                  (agent.first_name && agent.last_name ? `${agent.first_name} ${agent.last_name}` : null),
            email: agent.email || agent.contact?.email || agent.email_address,
            phone: agent.phone || agent.mobile || agent.contact_number || agent.contact?.phone || agent.telephone,
            whatsapp: agent.whatsapp || agent.whatsapp_number || agent.contact?.whatsapp,
            agentId: String(agent.id || agent.agent_id || agent.broker_id || ''),
            profileUrl: toAbsoluteUrl(agentUrl),
            company: agent.broker?.name || agent.company?.name || agent.agency_name || agent.broker_name || agent.agency,
            companyLogo: toAbsoluteUrl(agent.broker?.logo || agent.company?.logo || agent.broker_logo || agent.company_logo),
            profileImage: toAbsoluteUrl(agent.image || agent.photo || agent.avatar || agent.profile_image || agent.picture),
            location: agent.location?.name || agent.city || agent.area || agent.location || agent.region,
            totalListings: agent.total_listings || agent.property_count || agent.listings_count || agent.properties_count || agent.listing_count,
            activeListings: agent.active_listings || agent.active_properties || agent.active_count,
            verified: agent.verified || agent.is_verified || agent.is_active || false,
            languages: Array.isArray(agent.languages) ? agent.languages : 
                      (agent.languages ? String(agent.languages).split(',').map(l => l.trim()) : []),
            nationality: agent.nationality?.name || agent.nationality || agent.country,
            experience: agent.experience_years || agent.years_of_experience || agent.experience || agent.years,
            specializations: Array.isArray(agent.specializations) ? agent.specializations :
                           Array.isArray(agent.property_types) ? agent.property_types : 
                           (agent.specialization ? [agent.specialization] : []),
            rating: agent.rating || agent.average_rating || agent.score || agent.stars,
            reviewsCount: agent.reviews_count || agent.total_reviews || agent.review_count || agent.reviews,
            brokerPermitNo: agent.broker_permit_no || agent.rera_permit || agent.license_number || 
                          agent.permit_number || agent.license || agent.registration_no,
            lastActive: agent.last_active || agent.last_seen || agent.updated_at || agent.last_online,
            description: agent.description || agent.bio || agent.about || agent.summary,
        };
    }).filter(a => a.profileUrl || a.name);
};

// ============================================================================
// PRIORITY 2: __NEXT_DATA__ EXTRACTION
// ============================================================================

const extractNextData = (html) => {
    try {
        const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
        if (!match) {
            log.debug('__NEXT_DATA__ script tag not found');
            return null;
        }

        const data = JSON.parse(match[1]);
        log.debug('Parsed __NEXT_DATA__', { hasProps: !!data?.props });
        
        const pageProps = data?.props?.pageProps;
        if (!pageProps) {
            log.debug('No pageProps in __NEXT_DATA__');
            return null;
        }

        // Check all possible data locations
        const agents = pageProps.agents || pageProps.brokers ||
                      pageProps.searchResult?.agents || pageProps.searchResult?.brokers ||
                      pageProps.data?.agents || pageProps.data?.brokers ||
                      pageProps.initialData?.agents || pageProps.initialData?.brokers ||
                      pageProps.serverState?.agents || pageProps.serverState?.brokers;

        if (!Array.isArray(agents) || agents.length === 0) {
            log.debug('No agents in __NEXT_DATA__', { keys: Object.keys(pageProps).join(', ') });
            return null;
        }

        log.info('✓ __NEXT_DATA__ extraction successful', { count: agents.length });
        return parseApiAgents(agents);
        
    } catch (err) {
        log.debug('__NEXT_DATA__ extraction failed', { error: err.message });
        return null;
    }
};

// ============================================================================
// PRIORITY 3: HTML PARSING (Fallback)
// ============================================================================

const extractAgentCards = ($) => {
    const cards = [];
    log.debug('Attempting HTML card extraction');

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
        log.info('✓ HTML extraction successful (data-testid)', { count: cards.length });
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
        log.info('✓ HTML extraction successful (class-based)', { count: cards.length });
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
        log.info('✓ HTML extraction successful (semantic)', { count: cards.length });
    } else {
        log.warning('No agent cards found in HTML');
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
        
        if (!name || name.length < 2) return null; // Must have valid name

        const company = cleanText(
            card.find('[data-testid*="company"], [class*="company"], [class*="broker"], [class*="agency"]').first().text()
        );

        const phone = cleanText(
            card.find('[data-testid*="phone"], [class*="phone"], a[href^="tel:"]').first().text() ||
            card.find('a[href^="tel:"]').first().attr('href')?.replace('tel:', '')
        );

        const email = cleanText(
            card.find('[data-testid*="email"], [class*="email"], a[href^="mailto:"]').first().text() ||
            card.find('a[href^="mailto:"]').first().attr('href')?.replace('mailto:', '')
        );

        const whatsapp = cleanText(
            card.find('[data-testid*="whatsapp"], [class*="whatsapp"]').first().text() ||
            card.find('a[href*="wa.me"], a[href*="whatsapp"]').first().attr('href')?.match(/\d+/)?.[0]
        );

        const profileImage = toAbsoluteUrl(
            card.find('img').first().attr('src') || 
            card.find('img').first().attr('data-src') ||
            card.find('img').first().attr('data-lazy-src')
        );

        const location = cleanText(
            card.find('[data-testid*="location"], [class*="location"], [class*="area"]').first().text()
        );

        const totalListings = numberFromText(
            card.find('[data-testid*="listing"], [class*="listing"], [class*="property"]').first().text()
        );

        const rating = numberFromText(
            card.find('[data-testid*="rating"], [class*="rating"], [class*="stars"]').first().text()
        );

        const languages = [];
        card.find('[data-testid*="language"], [class*="language"]').each((_, lang) => {
            const langText = cleanText($(lang).text());
            if (langText) languages.push(langText);
        });

        return {
            name,
            email,
            phone,
            whatsapp,
            profileUrl,
            company,
            profileImage,
            location,
            totalListings,
            rating,
            languages: languages.length ? languages : null,
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
        const response = await gotScraping({
            url,
            proxyUrl,
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'accept-language': 'en-US,en;q=0.9',
                'referer': 'https://www.propertyfinder.ae/en/find-agent/search',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'same-origin',
            },
            timeout: { request: 30000 },
        });

        const $ = load(response.body);
        
        // Try __NEXT_DATA__ first on detail page
        const nextDataAgents = extractNextData(response.body);
        if (nextDataAgents && nextDataAgents.length > 0) {
            return nextDataAgents[0];
        }

        // Extract from JSON-LD
        const jsonLd = extractJsonLd($);
        
        // Extract from HTML
        const htmlData = extractDetailFromHtml($, url);
        
        // Merge data sources
        return { ...htmlData, ...jsonLd, profileUrl: url };
        
    } catch (err) {
        log.warning('Detail fetch failed', { url, error: err.message });
        return null;
    }
};

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
                    return {
                        name: data.name,
                        email: data.email,
                        phone: data.telephone || data.phone,
                        profileUrl: data.url,
                        company: data.worksFor?.name || data.affiliation?.name,
                        location: data.address?.addressLocality || data.workLocation,
                        description: data.description,
                        jobTitle: data.jobTitle,
                        nationality: data.nationality?.name,
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

    log.info('🚀 Starting PropertyFinder Agent Scraper', {
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
        log.info('✓ Proxy configured', { proxyUrl: proxyUrl ? 'Yes' : 'No' });
    } catch (err) {
        log.warning('Proxy configuration failed, proceeding without proxy', { error: err.message });
    }

    const seenUrls = new Set();
    const enqueuedPages = new Set();
    let totalSaved = 0;
    let currentPage = 1;

    // Try API-first approach
    log.info('🔍 Attempting API extraction (Priority 1)...');
    const apiAgents = await fetchFromInternalApi({ location, language, page: currentPage }, proxyUrl);
    
    if (apiAgents && apiAgents.length > 0) {
        log.info('✅ API extraction successful! Processing agents...');
        
        for (const agent of apiAgents) {
            if (totalSaved >= RESULTS_WANTED) break;
            if (!agent.profileUrl || seenUrls.has(agent.profileUrl)) continue;
            
            seenUrls.add(agent.profileUrl);
            
            if (collectDetails && agent.profileUrl) {
                try {
                    const detailData = await fetchDetailWithCheerio(agent.profileUrl, proxyUrl);
                    const mergedAgent = { ...agent, ...detailData };
                    await Actor.pushData(mergedAgent);
                    totalSaved++;
                    log.info(`✓ Saved agent ${totalSaved}/${RESULTS_WANTED}`, { name: mergedAgent.name });
                } catch (err) {
                    log.softFail('Detail fetch failed, saving basic data', { url: agent.profileUrl, error: err.message });
                    await Actor.pushData(agent);
                    totalSaved++;
                }
            } else {
                await Actor.pushData(agent);
                totalSaved++;
                log.info(`✓ Saved agent ${totalSaved}/${RESULTS_WANTED}`, { name: agent.name });
            }
        }
        
        if (totalSaved >= RESULTS_WANTED) {
            log.info('🎉 Desired results reached via API', { totalSaved });
            await Actor.exit();
            return;
        }
    }

    // Fallback to HTML scraping
    log.info('⚙️ Falling back to HTML scraping (Priority 2)...');
    
    const crawler = new CheerioCrawler({
        proxyConfiguration: proxyConfig,
        maxConcurrency: 3, // Lower concurrency for stealth
        maxRequestRetries: 3,
        requestHandlerTimeoutSecs: 90,

        async requestHandler({ $, request, body }) {
            const pageNo = request.userData.pageNo || 1;
            const html = body.toString();
            
            log.info(`📄 Processing page ${pageNo}...`);

            // Try __NEXT_DATA__ extraction
            let agents = extractNextData(html);

            // Fallback to HTML parsing
            if (!agents || agents.length === 0) {
                agents = extractAgentCards($);
            }

            if (!agents || agents.length === 0) {
                log.warning('⚠️ No agents found on page', { url: request.url, pageNo });
                return;
            }

            log.info(`Found ${agents.length} agents on page ${pageNo}`);

            for (const agent of agents) {
                if (totalSaved >= RESULTS_WANTED) {
                    log.info('🎯 Desired results reached', { totalSaved });
                    await crawler.autoscaledPool?.abort();
                    return;
                }

                const agentUrl = agent.profileUrl;
                if (!agentUrl || seenUrls.has(agentUrl)) continue;
                seenUrls.add(agentUrl);

                const baseRecord = { ...agent, profileUrl: agentUrl };

                if (!collectDetails) {
                    await Actor.pushData(baseRecord);
                    totalSaved++;
                    log.info(`✓ Saved agent ${totalSaved}/${RESULTS_WANTED}`, { name: agent.name });
                    continue;
                }

                try {
                    const detailData = await fetchDetailWithCheerio(agentUrl, proxyUrl);
                    const record = { ...baseRecord, ...detailData };
                    await Actor.pushData(record);
                    totalSaved++;
                    log.info(`✓ Saved agent ${totalSaved}/${RESULTS_WANTED}`, { name: record.name });
                } catch (err) {
                    log.softFail('Detail fetch failed, saving listing data', { url: agentUrl, error: err.message });
                    await Actor.pushData(baseRecord);
                    totalSaved++;
                }
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
                    log.info(`➡️ Enqueued page ${nextPage}`, { url: nextUrl });
                }
            }
        },

        failedRequestHandler({ request }, error) {
            log.error('Request failed', {
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

    log.info('✅ Scraping completed', { totalSaved, resultsWanted: RESULTS_WANTED });
}

main()
    .catch((err) => {
        log.exception(err, 'Fatal error occurred');
        process.exit(1);
    })
    .finally(async () => {
        await Actor.exit();
    });
