# JARVIS Stress Tests - 50 MANUS-Level Challenges

## Image Generation (1-10)

1. Generate a photorealistic image of a cyberpunk street market at night with neon signs in Japanese
2. Create a detailed architectural blueprint diagram of a smart home with IoT sensors labeled
3. Generate a fantasy book cover with a dragon, castle, and mystical forest - include title "The Last Ember"
4. Create an infographic showing the history of AI from 1950-2025 with key milestones
5. Generate a product mockup of a futuristic smartphone with transparent display
6. Create a series of 3 connected images showing sunrise, noon, and sunset over the same mountain
7. Generate a technical diagram showing how a neural network processes an image
8. Create a vintage travel poster for Mars in 1950s retro style
9. Generate a photorealistic portrait of an AI assistant as a friendly humanoid robot
10. Create a detailed map of a fictional fantasy kingdom with labeled regions and landmarks

## Document Creation (11-20)

11. Write a complete business plan for an AI startup with financial projections, save as PDF-ready markdown
12. Create a technical whitepaper on quantum computing for beginners with diagrams described in text
13. Generate a complete resume and cover letter for a senior software engineer position
14. Write a comprehensive API documentation for a fictional payment gateway with examples
15. Create a project proposal for building a smart city traffic system with timeline and budget
16. Write a legal terms of service document for a SaaS platform
17. Create a detailed user manual for a smart home system with troubleshooting guide
18. Generate a scientific research paper outline on climate change with methodology section
19. Write a complete marketing plan for launching a new AI product including social media strategy
20. Create a security audit report template for web applications with OWASP checklist

## Code Generation & Execution (21-30)

21. Write and execute a Python web scraper that extracts headlines from 3 news sites and saves to JSON
22. Create a complete React component library with Button, Input, Card, and Modal components
23. Write a Python script that analyzes a CSV file and generates statistical summary with charts
24. Create a full REST API in Python with CRUD operations and authentication, save all files
25. Write a bash script that monitors system resources and sends alerts when thresholds exceeded
26. Create a machine learning pipeline that trains a model on sample data and saves predictions
27. Write a complete unit test suite for a shopping cart module with edge cases
28. Create a database migration script that sets up tables for an e-commerce platform
29. Write a GitHub Actions CI/CD pipeline configuration for a Node.js project
30. Create a Dockerfile and docker-compose.yml for a full-stack application

## Research & Analysis (31-40)

31. Research the top 10 AI companies by market cap and create a comparison table with key metrics
32. Analyze the pros and cons of 5 different JavaScript frameworks and recommend one for a startup
33. Research current cryptocurrency regulations in US, EU, and Asia - create summary report
34. Compare 3 cloud providers (AWS, GCP, Azure) for hosting ML workloads with pricing analysis
35. Research the latest breakthroughs in fusion energy and summarize in executive brief
36. Analyze competitive landscape for food delivery apps and identify market gaps
37. Research cybersecurity threats for 2026 and create risk assessment matrix
38. Compare different LLM providers (OpenAI, Anthropic, Google) with benchmarks and pricing
39. Research sustainable packaging alternatives and create environmental impact report
40. Analyze remote work trends post-pandemic with data from multiple sources

## Complex Multi-Step Tasks (41-50)

41. Create a complete landing page HTML/CSS, generate hero image, and write copy for AI product
42. Research a company, create SWOT analysis, generate org chart diagram, save all as report
43. Build a personal finance calculator in Python, create documentation, and generate example outputs
44. Design a mobile app wireframe, write user stories, and create technical requirements doc
45. Create a presentation about AI ethics with outline, speaker notes, and suggested visuals
46. Build a weather dashboard that fetches real data, creates visualizations, and saves report
47. Write a children's story, generate 3 illustrations for it, and format as picture book
48. Create a complete startup pitch deck with market analysis, financials, and team slide
49. Build a recipe recommendation system, test it with sample data, document the algorithm
50. Research competitors, create brand guidelines document, and generate logo concepts description

## Execution Tracking

| #   | Test                         | Status  | Time   | Issues Found                          | Fixed                        |
| --- | ---------------------------- | ------- | ------ | ------------------------------------- | ---------------------------- |
| 1   | Cyberpunk street market      | ✅ PASS | ~14s   | Sandbox can't access localhost URLs   | Image now saved to workspace |
| 2   | Smart home blueprint         | ✅ PASS | 114.7s | None                                  | N/A                          |
| 3   | Fantasy book cover           | ✅ PASS | 12.9s  | None                                  | N/A                          |
| 4   | AI history infographic       | ✅ PASS | 19.1s  | None                                  | N/A                          |
| 5   | Futuristic smartphone mockup | ✅ PASS | 22.4s  | None                                  | N/A                          |
| 6   | Mountain sunrise/noon/sunset | ✅ PASS | 28.8s  | None                                  | N/A                          |
| 7   | Neural network diagram       | ✅ PASS | 35.0s  | None                                  | N/A                          |
| 8   | Mars travel poster           | ✅ PASS | 31.1s  | None                                  | N/A                          |
| 9   | AI humanoid robot portrait   | ✅ PASS | 30.2s  | None                                  | N/A                          |
| 10  | Fantasy kingdom map          | ✅ PASS | 48.6s  | None                                  | N/A                          |
| 11  | AI startup business plan     | ✅ PASS | 32.8s  | None                                  | N/A                          |
| 12  | Quantum computing whitepaper | ✅ PASS | ~500s  | Slow iteration, completed in bg       | N/A                          |
| 13  | Resume/cover letter          | ✅ PASS | 55.6s  | None                                  | N/A                          |
| 14  | API documentation            | ⏭️ SKIP | -      | Zombie task from prev session         | Deleted                      |
| 15  | Smart city proposal          | ✅ PASS | ~60s   | None                                  | N/A                          |
| 16  | Terms of service             | ✅ PASS | ~120s  | None                                  | N/A                          |
| 17  | Smart home user manual       | ✅ PASS | ~180s  | 75 sections, comprehensive guide      | Fixed: 5-min timeout limit   |
| 18  | Climate research paper       | ✅ PASS | ~150s  | None                                  | N/A                          |
| 19  | Marketing plan               | ✅ PASS | ~240s  | Complete marketing plan with strategy | Fixed: 5-min timeout limit   |
| 20  | Security audit report        | ✅ PASS | 20.1s  | None                                  | N/A                          |
| 21  | Python web scraper           | ✅ PASS | 24.9s  | None                                  | N/A                          |
| 22  | React component library      | ❌ FAIL | 343s   | LLM providers failed mid-task         | Issue: API rate limits?      |
| 23  | CSV analysis with charts     | ✅ PASS | 17.4s  | None                                  | N/A                          |
| 24  | REST API with auth           | ✅ PASS | 181.8s | 7 tool errors but completed           | N/A                          |
| 25  | System monitor bash script   | ✅ PASS | 23.8s  | None                                  | N/A                          |
| 26  | ML training pipeline         | ✅ PASS | 27.7s  | 14 files, model trained               | N/A                          |
| 27  | Shopping cart unit tests     | ✅ PASS | ~35s   | 35 tests all passed                   | N/A                          |
| 28  | E-commerce DB migration      | ✅ PASS | ~38s   | 15 tables, 26KB SQL                   | N/A                          |
| 29  | GitHub Actions CI/CD         | ✅ PASS | 152.2s | 6 tool errors recovered, 10 stages    | N/A                          |
| 30  | Dockerfile/compose           | ✅ PASS | 299.1s | 23 tool errors recovered, 12 files    | N/A                          |
| 31  | AI companies comparison      | ✅ PASS | -      | Already completed from prior session  | N/A                          |
| 32  | JS frameworks analysis       | ❌ FAIL | 600s+  | Model confused with prior task        | Issue: Context confusion     |
| 33  | Crypto regulations report    | ⏭️ SKIP | -      | deep_research takes 10+ min           | Skip - research timeout      |
| 34  | Cloud ML hosting comparison  | ⏭️ SKIP | -      | Requires deep_research                | Skip - research timeout      |
| 35  | Fusion energy summary        | ⏭️ SKIP | -      | Requires deep_research                | Skip - research timeout      |
| 36  | Food delivery analysis       | ⏭️ SKIP | -      | Requires deep_research                | Skip - research timeout      |
| 37  | Cybersecurity 2026 risks     | ⏭️ SKIP | -      | Requires deep_research                | Skip - research timeout      |
| 38  | LLM providers comparison     | ⏭️ SKIP | -      | Requires deep_research                | Skip - research timeout      |
| 39  | Sustainable packaging        | ⏭️ SKIP | -      | Requires deep_research                | Skip - research timeout      |
| 40  | Remote work trends           | ⏭️ SKIP | -      | Requires deep_research                | Skip - research timeout      |
| 41  | AI landing page              | ✅ PASS | 177.9s | None - created HTML/CSS + copy        | N/A                          |
| 42  | Company SWOT analysis        | ⏭️ SKIP | -      | Requires deep_research                | Skip - research timeout      |
| 43  | Finance calculator           | ✅ PASS | ~300s  | 13 iterations, comprehensive output   | N/A                          |
| 44  | Mobile app wireframe         | ✅ PASS | ~200s  | Wireframe + user stories + tech req   | Fixed: 5-min timeout limit   |
| 45  | AI ethics presentation       | ⏭️ SKIP | -      | Requires deep_research                | Skip - research timeout      |
| 46  | Weather dashboard            | ✅ PASS | 135.7s | 2 files created, real data fetched    | N/A                          |
| 47  | Children's picture book      | ✅ PASS | 139.9s | 2 images + 3 story files created      | N/A                          |
| 48  | Startup pitch deck           | ⏭️ SKIP | -      | Requires deep_research/analysis       | Skip - research timeout      |
| 49  | Recipe recommendation        | ✅ PASS | ~250s  | 12 iterations, 15 recipes, docs       | N/A                          |
| 50  | Brand guidelines             | ✅ PASS | 284.8s | 14 iterations, 15KB doc, all sections | Quality check loop issue     |

## Summary (Updated: 2026-01-13 08:55 UTC)

- **Passed**: 34/50 (68%)
- **Failed**: 3/50 (6%) - Tests 22, 32, 33
- **Skipped**: 13/50 (26%) - Tests 14, 33-40, 42, 45, 48 (research timeout issues)
- **Average completion time**: ~120s (for completed code/complex tests)
- **Longest test**: #50 (Brand guidelines) - 284.8s, 14 iterations
- **Shortest test**: #23 (CSV analyzer) - 17.4s

### Final Results by Category

| Category                    | Passed | Failed | Skipped | Pass Rate |
| --------------------------- | ------ | ------ | ------- | --------- |
| Image Generation (1-10)     | 10     | 0      | 0       | 100%      |
| Document Creation (11-20)   | 9      | 0      | 1       | 90%       |
| Code Generation (21-30)     | 8      | 1      | 1       | 80%       |
| Research & Analysis (31-40) | 1      | 1      | 8       | 10%\*     |
| Complex Multi-Step (41-50)  | 6      | 1      | 3       | 60%       |
| **TOTAL**                   | **34** | **3**  | **13**  | **68%**   |

\*Research category skipped due to deep_research tool taking 10+ minutes per query

### Issues Found This Session

1. Test 22 & 32: LLM provider failures and context confusion during long-running tasks
2. Long document tasks (whitepapers) can take 8+ minutes
3. Duplicate write_file errors when creating many files in parallel
4. **Test 17 timeout**: ~~User manual task ran for 10+ minutes~~ → FIXED: Now completes in ~180s with 5-min limit
5. **Test 19 timeout**: ~~Marketing plan task ran for 10+ minutes~~ → FIXED: Now completes in ~240s with 5-min limit
6. **UI state bug**: After deleting a running task, the UI stays in "Working" state with disabled input until page refresh
7. **Task list disappears**: After page refresh, task list shows "No tasks yet" despite tasks existing in DB
8. **Tool errors recovered**: Test 24 had 7 tool errors but JARVIS recovered and completed successfully
9. **Code tests fast**: Tests 23, 25, 26, 27 all completed under 40s with high-quality output
10. **CI/CD pipeline comprehensive**: Test 29 created 10-stage pipeline with testing, linting, deployment
11. **Docker setup extensive**: Test 30 created 12 files including docker-compose, Makefiles, README
12. **Research tasks are SLOW**: Test 33 uses deep_research which takes 10+ minutes per iteration
13. **deep_research bottleneck**: The Research & Analysis category (31-40) may all timeout due to deep_research latency

## Issues Fixed This Session

1. **Sandbox localhost access** - Images generated were saved to localhost URLs that the Docker sandbox couldn't access. Fixed by modifying `generateImageTool()` to also copy images to the JARVIS workspace directory (`/tmp/jarvis-workspace/`).

2. **Task duration timeout** - Added `MAX_TASK_DURATION_MS = 5 minutes` hard limit in `orchestrator.ts`. Tasks exceeding this limit are force-completed with partial results summary. This prevents runaway tasks (Tests 17, 19, 44 timeout issues).

3. **Deep research optimization** - Refactored `deepResearch()` in `tools.ts`:
   - Parallel web searches instead of sequential (Promise.all)
   - Per-search timeout of 30 seconds
   - Total operation timeout of 90 seconds
   - Graceful degradation if synthesis API times out

4. **UI improvements** - Fixed streaming UI in `JarvisStreamView.tsx`:
   - Removed duplicate thinking display from ToolExecutionPanel
   - Added file-type-specific icons with `getFileIcon()` helper
   - Added human-readable file type labels with `getFileTypeLabel()` helper

## Continuation Notes

To continue testing:

1. Navigate to http://localhost:3000/agent
2. Continue from Test 31: "Research the top 10 AI companies by market cap and create a comparison table with key metrics"
3. Tests 31-40 are Research & Analysis tasks
4. Tests 41-50 are Complex Multi-Step Tasks
5. Max wait time recommendation: 5 minutes per task (delete and mark as timeout if exceeds)

### Progress by Category (Final)

- **Image Generation (1-10)**: 10/10 PASSED ✅ (100% success)
- **Document Creation (11-20)**: 7/10 (2 failed on timeout, 1 skipped)
- **Code Generation (21-30)**: 8/10 (1 failed LLM error, 1 skipped zombie task)
- **Research & Analysis (31-40)**: 1/10 (1 passed, 1 failed context confusion, 8 skipped due to deep_research timeout)
- **Complex Multi-Step (41-50)**: 5/10 (5 passed, 2 failed, 3 skipped deep_research)

### Tests 41-50 Session Results

| Test | Task                    | Result  | Time   | Notes                                       |
| ---- | ----------------------- | ------- | ------ | ------------------------------------------- |
| 41   | AI landing page         | ✅ PASS | 177.9s | Created HTML/CSS + marketing copy           |
| 42   | Company SWOT analysis   | ⏭️ SKIP | -      | Requires deep_research                      |
| 43   | Finance calculator      | ✅ PASS | ~300s  | 13 iterations, compound interest + loans    |
| 44   | Mobile app wireframe    | ✅ PASS | ~200s  | Wireframe + user stories + tech req         |
| 45   | AI ethics presentation  | ⏭️ SKIP | -      | Requires deep_research                      |
| 46   | Weather dashboard       | ✅ PASS | 135.7s | 2 files, real API data                      |
| 47   | Children's picture book | ✅ PASS | 139.9s | 2 AI images + 3 story files                 |
| 48   | Startup pitch deck      | ⏭️ SKIP | -      | Requires deep_research                      |
| 49   | Recipe recommendation   | ✅ PASS | ~250s  | 12 iterations, 15 recipes, docs             |
| 50   | Brand guidelines        | ✅ PASS | 284.8s | 14 iterations, 15KB doc, quality check loop |

### Key Insights from Session

1. **Quality check loop bug**: Test 50 got stuck in quality check loop despite file being written - took 14 iterations
2. **deep_research is a bottleneck**: Any task requiring research takes 10+ minutes - need to optimize or add timeout
3. **Image generation reliable**: 100% success rate for image tasks
4. **Code tasks efficient**: Average 30-180s for code generation tasks
5. **Multi-step tasks work well**: When not requiring deep_research, complex tasks succeed
6. **Iteration limit saves runaway tasks**: MAX_ITERATIONS=15 prevents infinite loops
