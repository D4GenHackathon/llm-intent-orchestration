"""FastMCP Server for IoT Orchestration."""
from fastmcp import FastMCP
from crew.crew import CustomCrew

# Initialize MCP server
mcp = FastMCP("IoT Orchestration MCP Server")
custom_crew = CustomCrew()


@mcp.tool()
def run_all_agents() -> str:
    """Run all IoT orchestration agents."""
    result = custom_crew.run_all()
    return str(result)


@mcp.tool()
def run_security_agent() -> str:
    """Run security and credentials monitoring agent."""
    result = custom_crew.run_security()
    return str(result)


@mcp.tool()
def run_deployment_agent() -> str:
    """Run deployment monitoring agent."""
    result = custom_crew.run_deployment()
    return str(result)


@mcp.tool()
def run_orchestration_agent() -> str:
    """Run device orchestration agent."""
    result = custom_crew.run_orchestration()
    return str(result)


@mcp.tool()
def run_network_agent() -> str:
    """Run network auto-configuration agent."""
    result = custom_crew.run_network()
    return str(result)


@mcp.tool()
def run_diagnosis_agent() -> str:
    """Run diagnosis support agent."""
    result = custom_crew.run_diagnosis()
    return str(result)


@mcp.tool()
def check_drug_interactions(query: str = "", drugs: list[str] | None = None) -> str:
    """Run the database-first drug interaction workflow."""
    result = custom_crew.run_drug_interaction(query=query, drugs=drugs)
    return str(result)


@mcp.tool()
def lookup_drug_side_effects(query: str = "", drug_name: str = "") -> str:
    """Run the structured side-effect lookup workflow."""
    result = custom_crew.run_side_effect_lookup(query=query, drug_name=drug_name)
    return str(result)


@mcp.tool()
def predict_health_risk(
    respiratory_rate: float,
    oxygen_saturation: float,
    o2_scale: float,
    systolic_bp: float,
    heart_rate: float,
    temperature: float,
    consciousness: str,
    on_oxygen: float,
) -> str:
    """Run the health risk prediction workflow with evidence."""
    result = custom_crew.run_health_risk_prediction(
        {
            "respiratory_rate": respiratory_rate,
            "oxygen_saturation": oxygen_saturation,
            "o2_scale": o2_scale,
            "systolic_bp": systolic_bp,
            "heart_rate": heart_rate,
            "temperature": temperature,
            "consciousness": consciousness,
            "on_oxygen": on_oxygen,
        }
    )
    return str(result)


if __name__ == "__main__":
    mcp.run()
