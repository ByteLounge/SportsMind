import json
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

class GoogleCricketScraper:
    """
    Senior-level implementation for scraping live sports scores from Google Search.
    Utilizes stealth arguments and dynamic XPath selectors targeting 'imso' attributes.
    """
    def __init__(self, headless=True):
        self.chrome_options = Options()
        
        # Headless Execution: Run in background without window popup
        if headless:
            self.chrome_options.add_argument("--headless=new")
        
        # Stealth Integration: Custom User-Agent and Automation bypass
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        self.chrome_options.add_argument(f"user-agent={user_agent}")
        
        # Prevent detection as a bot
        self.chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        self.chrome_options.add_argument("--no-sandbox")
        self.chrome_options.add_argument("--disable-dev-shm-usage")
        self.chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        self.chrome_options.add_experimental_option("useAutomationExtension", False)
        
        self.driver = None

    def setup_driver(self):
        """Initializes WebDriver with service and options."""
        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=self.chrome_options)
        
        # Advanced Stealth: Remove the 'webdriver' flag from navigator
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

    def scrape_live_score(self, match_query="CSK vs LSG live score"):
        """
        Navigates to Google and extracts scorecard data using WebDriverWait for JS stability.
        """
        if not self.driver:
            self.setup_driver()
            
        try:
            # Construct Google Search URL
            url = f"https://www.google.com/search?q={match_query.replace(' ', '+')}"
            self.driver.get(url)

            # Wait for the International Match Sports Online (imso) component to load
            wait = WebDriverWait(self.driver, 15)
            scorecard_xpath = "//div[contains(@class, 'imso-mo') or contains(@class, 'imso-soa')]"
            wait.until(EC.presence_of_element_located((By.XPATH, scorecard_xpath)))

            # Data Extraction
            data = {
                "match": match_query,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "teams": []
            }

            # Target Team Names and Scores using imso class patterns
            # imso_mt__tm-nm: Team Names
            # imso_mt__lg-sc: Large Scores
            # imso_mt__ovr: Overs information
            team_names = self.driver.find_elements(By.XPATH, "//div[contains(@class, 'imso_mt__tm-nm')]")
            scores = self.driver.find_elements(By.XPATH, "//div[contains(@class, 'imso_mt__lg-sc')]")
            overs = self.driver.find_elements(By.XPATH, "//div[contains(@class, 'imso_mt__ovr')]")

            # Extract info for both teams
            for i in range(min(len(team_names), 2)):
                team_data = {
                    "name": team_names[i].text.strip(),
                    "score": scores[i].text.strip() if i < len(scores) else "N/A",
                    "overs": overs[i].text.strip() if i < len(overs) else ""
                }
                data["teams"].append(team_data)

            # Match Status (e.g., "CSK needs 42 runs in 20 balls")
            try:
                # Target the status message or result summary
                status_xpath = "//div[contains(@class, 'imso_mt__ndl-p') or contains(@class, 'imso_mt__stts-msg')]"
                data["match_status"] = self.driver.find_element(By.XPATH, status_xpath).text.strip()
            except:
                data["match_status"] = "Status summary unavailable"

            return data

        except Exception as e:
            # Error Handling for cases where the match isn't live or layout changed
            return {
                "error": "Failed to extract scorecard.",
                "details": str(e),
                "suggestion": "Verify that the match is currently live and that Google is displaying the scorecard OneBox."
            }
        
        finally:
            if self.driver:
                self.driver.quit()

if __name__ == "__main__":
    # Initialize and execute scraper
    scraper = GoogleCricketScraper(headless=True)
    result = scraper.scrape_live_score("CSK vs LSG live score")
    
    # Output as clean JSON string
    print(json.dumps(result, indent=4))
