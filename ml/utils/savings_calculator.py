"""
Standardized savings calculation utility for VM right-sizing recommendations.
Feature: vm-rightsizing-critical-fixes
Requirements: 6.1, 6.2, 6.3, 6.4, 6.6
"""

from typing import Optional, Dict, Union


def calculate_savings(
    current_price_hr: Optional[float], 
    recommended_price_hr: Optional[float]
) -> Dict[str, Optional[float]]:
    """
    Standardized savings calculation for VM recommendations.
    
    Args:
        current_price_hr: Current VM price per hour (can be None)
        recommended_price_hr: Recommended VM price per hour (can be None)
    
    Returns:
        Dictionary with savings metrics:
        - savings_per_hour: Hourly savings (current - recommended)
        - savings_per_month: Monthly savings (savings_per_hour * 730)
        - savings_per_year: Yearly savings (savings_per_hour * 8760)
        - savings_percentage: Percentage savings ((savings_per_hour / current) * 100)
        
        All values are None if either price is None.
    
    Formula:
        savings_per_hour = current_price_per_hour - recommended_price_per_hour
        savings_per_month = savings_per_hour * 730
        savings_per_year = savings_per_hour * 8760
        savings_percentage = (savings_per_hour / current_price_per_hour) * 100
    """
    # If either price is None/null, return all None values
    if current_price_hr is None or recommended_price_hr is None:
        return {
            "savings_per_hour": None,
            "savings_per_month": None,
            "savings_per_year": None,
            "savings_percentage": None
        }
    
    # Calculate hourly savings (can be negative for undersized VMs)
    savings_hr = current_price_hr - recommended_price_hr
    
    # Calculate all savings metrics
    return {
        "savings_per_hour": round(savings_hr, 4),
        "savings_per_month": round(savings_hr * 730, 2),
        "savings_per_year": round(savings_hr * 8760, 2),
        "savings_percentage": round((savings_hr / current_price_hr) * 100, 2) if current_price_hr > 0 else 0
    }


def format_savings_message(
    finding: str,
    current_instance: str,
    recommended_instance: Optional[str],
    savings_data: Dict[str, Optional[float]]
) -> str:
    """
    Generate human-readable recommendation message.
    
    Args:
        finding: Classification result ("Optimal", "Oversized", "Undersized")
        current_instance: Current instance type
        recommended_instance: Recommended instance type (None if no match)
        savings_data: Output from calculate_savings()
    
    Returns:
        Human-readable recommendation message
    """
    if finding == "Optimal":
        return "Resource is optimally provisioned — no action required."
    
    if finding == "Oversized":
        if recommended_instance is None:
            return "No smaller instance available in this region"
        savings_month = savings_data.get("savings_per_month")
        if savings_month is None:
            return f"Oversized — consider downsizing from {current_instance} to {recommended_instance}"
        return (f"Oversized — downsize from {current_instance} to {recommended_instance} "
                f"and save ${savings_month:.2f}/mo.")
    
    if finding == "Undersized":
        if recommended_instance is None:
            return "No larger instance available in this region"
        savings_month = savings_data.get("savings_per_month")
        if savings_month is None:
            return f"Undersized — consider upgrading from {current_instance} to {recommended_instance}"
        # For undersized, savings is negative (additional cost)
        extra_cost = abs(savings_month)
        return (f"Undersized — upgrade from {current_instance} to {recommended_instance} "
                f"(+${extra_cost:.2f}/mo) for better performance.")
    
    return "Unknown classification"
