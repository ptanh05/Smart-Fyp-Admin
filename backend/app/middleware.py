from django.http import HttpResponseForbidden

class BotProtectionMiddleware:
    """
    Middleware to block common bot/crawler User-Agents.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
        blocked_agents = ['python-requests', 'curl', 'wget', 'scrapy', 'postman']
        
        if any(bot in user_agent for bot in blocked_agents):
            return HttpResponseForbidden("Access Denied: Bot/Crawler detected.")

        return self.get_response(request)
