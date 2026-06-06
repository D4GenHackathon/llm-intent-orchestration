"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Network, Lock, Users, Zap, AlertCircle, MessageCircle } from "lucide-react";

interface NetworkPolicy {
  id: string;
  department: string;
  resourceAccess: string[];
  bandwidth: number;
  priority: "low" | "medium" | "high";
  enabled: boolean;
}

interface SDNController {
  id: string;
  name: string;
  status: "online" | "offline";
  connectedDevices: number;
  uptime: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  message: string;
  timestamp: string;
}

// Network Chatbot Component
function NetworkChatbot({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      message: "Welcome to Network Management Agent! I can help you configure your bioinstitution IOT device network using natural language, our management mainly based on Software-Defined Networking (SDN). What would you like to do?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (messageToSend?: string) => {
    const messageText = messageToSend || input;
    if (!messageText.trim() || loading) return;

    // Add user message
    const userMessage: ChatMessage = {
      role: "user",
      message: messageText,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    if (!messageToSend) setInput("");
    setLastMessage(messageText);
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/network/chat", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llm-agent-ollama",
          messages: [
            {
              role: "user",
              content: messageText,
            },
          ],
          temperature: 0,
          stream: false,
          additionalProp1: {},
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("API Response:", data); // Debug log
      // Parse response format
      const rawContent = data.choices?.[0]?.message?.content || data.message || "No response received";
      
      // Parse tool response format
      const toolMatch = rawContent.match(/^(\w+):\s*(\{[\s\S]*\})$/);
      let assistantContent = rawContent;
      
      if (toolMatch) {
        const toolName = toolMatch[1];
        let dataString = toolMatch[2];
        try {
          // Formalize JSON format
          const jsonString = dataString.replace(/'/g, '"');
          const toolData = JSON.parse(jsonString);
          
          // Beautify the response
          assistantContent = `Tool Used: ${toolName}\n\n`;
          assistantContent += "Network Data:\n";
          Object.entries(toolData).forEach(([key, value]) => {
            assistantContent += `• ${key}: ${value}\n`;
          });
        } catch (e) {
          console.error("Parse error:", e);
          // If parsing fails, use raw content
          assistantContent = rawContent;
        }
      }
      
      const assistantMessage: ChatMessage = {
        role: "assistant",
        message: assistantContent,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorMsg: ChatMessage = {
        role: "assistant",
        message: `Error: ${errorMessage}\n\n Click the reload button below to retry.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastMessage) {
      sendMessage(lastMessage);
    }
  };

  const handleEdit = (index: number, message: string) => {
    setEditingIndex(index);
    setEditText(message);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditText("");
  };

  const handleSubmitEdit = (index: number) => {
    if (editText.trim()) {
      // Remove the edited message and all responses after it
      const newMessages = messages.slice(0, index);
      setMessages(newMessages);
      setEditingIndex(null);
      
      // Send the modified message
      sendMessage(editText);
    }
  };

  const handleDelete = (index: number) => {
    // Remove the message and all responses after it
    const newMessages = messages.slice(0, index);
    setMessages(newMessages);
  };

  return (
    <div className="flex flex-col h-96 rounded-lg border bg-background">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b flex items-center gap-2 bg-muted">
        <MessageCircle className="h-5 w-5" />
        <h3 className="font-semibold">Network Assistant</h3>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, idx) => (
          <div
            key={msg.timestamp + idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {editingIndex === idx ? (
              <div className="flex flex-col gap-2 max-w-xs">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm resize-none"
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleSubmitEdit(idx)}
                    disabled={loading || !editText.trim()}
                    size="sm"
                    className="flex-1"
                  >
                    Send
                  </Button>
                  <Button
                    onClick={handleCancelEdit}
                    disabled={loading}
                    size="sm"
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div
                  className={`max-w-xs rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-muted text-foreground border"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-keep">{msg.message}</p>
                  {msg.message.includes("Error:") && msg.role === "assistant" && (
                    <Button
                      onClick={handleRetry}
                      disabled={loading}
                      size="sm"
                      variant="outline"
                      className="mt-2 text-xs"
                    >
                      🔄 Retry
                    </Button>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="flex gap-1">
                    <Button
                      onClick={() => handleEdit(idx, msg.message)}
                      disabled={loading}
                      size="sm"
                      variant="ghost"
                      className="text-xs h-6 px-2"
                    >
                      ✏️ Edit
                    </Button>
                    <Button
                      onClick={() => handleDelete(idx)}
                      disabled={loading}
                      size="sm"
                      variant="ghost"
                      className="text-xs h-6 px-2 text-destructive"
                    >
                      🗑️ Delete
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted text-foreground border rounded-lg px-3 py-2">
              <p className="text-sm">Thinking...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="px-4 py-3 border-t flex gap-2 bg-muted/30">
        <Input
          placeholder="Ask about network configuration..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          disabled={loading}
          className="text-sm"
        />
        <Button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          size="sm"
          className="px-3"
        >
          <MessageCircle className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function NetworkManagementPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [policies, setPolicies] = useState<NetworkPolicy[]>([
    {
      id: "1",
      department: "ICU",
      resourceAccess: ["sensors", "alerts", "analytics"],
      bandwidth: 100,
      priority: "high",
      enabled: true,
    },
    {
      id: "2",
      department: "Radiology",
      resourceAccess: ["sensors", "devices"],
      bandwidth: 50,
      priority: "medium",
      enabled: true,
    },
  ]);

  const [controllers, setControllers] = useState<SDNController[]>([
    {
      id: "1",
      name: "Main Controller",
      status: "online",
      connectedDevices: 45,
      uptime: "99.8%",
    },
    {
      id: "2",
      name: "Backup Controller",
      status: "online",
      connectedDevices: 12,
      uptime: "98.5%",
    },
  ]);

  const [newPolicy, setNewPolicy] = useState<{
    department: string;
    resourceAccess: string[];
    bandwidth: number;
    priority: "low" | "medium" | "high";
  }>({
    department: "",
    resourceAccess: ["sensors"],
    bandwidth: 50,
    priority: "medium",
  });

  const [showNewPolicyForm, setShowNewPolicyForm] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Check authentication and authorization
  useEffect(() => {
    if (!session) {
      router.push("/login");
    }
  }, [session, router]);

  // Network Agent API stream integration
  const networkAgentStream = async (params: any) => {
    try {
      const userQuery = params.userInput;

      // Show processing message
      await params.streamMessage("Processing your network configuration request...");

      // Send request to FastAPI backend
      const response = await fetch("http://localhost:8000/api/network/configure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: userQuery,
          department: "General",
          priority: "medium",
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      const data = await response.json();
      const taskId = data.task_id;

      // Stream initial response
      await params.streamMessage(`Task started (ID: ${taskId})\n⏳ Configuring network...`);

      // Poll for task completion
      let completed = false;
      let pollCount = 0;
      const maxPolls = 120; // 2 minutes with 1-second intervals

      while (!completed && pollCount < maxPolls) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        pollCount++;

        try {
          const statusResponse = await fetch(`http://localhost:8000/api/network/status/${taskId}`);
          if (!statusResponse.ok) throw new Error("Failed to fetch status");

          const statusData = await statusResponse.json();

          if (statusData.status === "completed") {
            await params.streamMessage(
              `Configuration Applied!\n\n${statusData.result}`
            );
            completed = true;
          } else if (statusData.status === "failed") {
            await params.streamMessage(
              `Configuration Failed!\n\nError: ${statusData.error}`
            );
            completed = true;
          } else {
            // Update streaming message with progress
            const dots = ".".repeat((pollCount % 3) + 1);
            await params.streamMessage(
              `Processing${dots} (${pollCount}s elapsed)`
            );
          }
        } catch (statusError) {
          console.error("Status check error:", statusError);
        }
      }

      if (!completed) {
        await params.streamMessage(
          "Configuration timeout. The process may still be running in the background."
        );
      }

      await params.endStreamMessage();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await params.injectMessage(`Error: ${errorMessage}`);
      await params.endStreamMessage();
    }
  };

  // Check if user is admin
  const isAdmin = session?.user?.role === "ADMIN";

  if (!isClient || !session) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Alert className="border-destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Access denied. Network management is restricted to administrators only.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleAddPolicy = () => {
    if (newPolicy.department.trim()) {
      const policy: NetworkPolicy = {
        id: Date.now().toString(),
        ...newPolicy,
        enabled: true,
      };
      setPolicies([...policies, policy]);
      setNewPolicy({
        department: "",
        resourceAccess: ["sensors"],
        bandwidth: 50,
        priority: "medium",
      });
      setShowNewPolicyForm(false);
    }
  };

  const handleTogglePolicy = (id: string) => {
    setPolicies(
      policies.map((policy) =>
        policy.id === id ? { ...policy, enabled: !policy.enabled } : policy
      )
    );
  };

  const handleDeletePolicy = (id: string) => {
    setPolicies(policies.filter((policy) => policy.id !== id));
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Network className="h-8 w-8 text-primary" />
          Software-Defined Network (SDN) Management
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure network policies, control resource allocation, and manage department access
        </p>
      </div>

      {/* SDN Controllers Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {controllers.map((controller) => (
          <Card key={controller.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                {controller.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status:</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    controller.status === "online"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {controller.status.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Connected Devices:</span>
                <span className="font-semibold">{controller.connectedDevices}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Uptime:</span>
                <span className="font-semibold">{controller.uptime}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Network Policies */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Network Policies</CardTitle>
                <CardDescription>
                  Manage department access and resource allocation
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setShowNewPolicyForm(true)}>
              + New Policy
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* New Policy Form */}
          {showNewPolicyForm && (
            <div className="border rounded-lg p-4 bg-muted/50 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Create New Network Policy
              </h3>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    placeholder="e.g., Emergency Department"
                    value={newPolicy.department}
                    onChange={(e) =>
                      setNewPolicy({ ...newPolicy, department: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>Bandwidth Limit (Mbps)</Label>
                  <Input
                    type="number"
                    min="10"
                    max="1000"
                    value={newPolicy.bandwidth}
                    onChange={(e) =>
                      setNewPolicy({ ...newPolicy, bandwidth: parseInt(e.target.value) })
                    }
                  />
                </div>

                <div>
                  <Label>Priority Level</Label>
                  <Select
                    value={newPolicy.priority}
                    onValueChange={(value: "low" | "medium" | "high") =>
                      setNewPolicy({ ...newPolicy, priority: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAddPolicy} className="flex-1">
                    Create Policy
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowNewPolicyForm(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Policies List */}
          <div className="space-y-2">
            {policies.map((policy) => (
              <div
                key={policy.id}
                className="border rounded-lg p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold">{policy.department}</h4>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        policy.priority === "high"
                          ? "bg-red-100 text-red-800"
                          : policy.priority === "medium"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {policy.priority.toUpperCase()}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        policy.enabled
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {policy.enabled ? "ENABLED" : "DISABLED"}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      <strong>Resources:</strong>{" "}
                      {policy.resourceAccess.join(", ")}
                    </p>
                    <p>
                      <strong>Bandwidth:</strong> {policy.bandwidth} Mbps
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={policy.enabled ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleTogglePolicy(policy.id)}
                  >
                    {policy.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeletePolicy(policy.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security Information */}
      <Alert>
        <Lock className="h-4 w-4" />
        <AlertDescription>
          <strong>LLM-Powered Network Configuration:</strong> Express your network configuration
          needs in natural language. The AI agent analyzes your request and configures the SDN
          network automatically with optimal policies and bandwidth allocation.
        </AlertDescription>
      </Alert>

      {/* Floating Network Assistant Chatbot */}
      {isClient && (
        <div className="bg-card rounded-lg border shadow-sm p-6">
          <NetworkChatbot sessionId={`user-${session?.user?.email || "guest"}`} />
        </div>
      )}

      {/* ONOS UI Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>ONOS Network Dashboard</CardTitle>
              <CardDescription>
                Real-time network topology and management interface
              </CardDescription>
            </div>
            <Button
              onClick={() => window.open("http://localhost:8181/onos/ui", "_blank")}
              className="ml-4"
            >
              🔗 Open in New Window
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Click the button above to open the ONOS network dashboard in a new window.</p>
            <p>
              <strong>Login Credentials:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Username:</strong> onos</li>
              <li><strong>Password:</strong> rocks</li>
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Note: Due to browser security restrictions, the ONOS UI cannot be embedded directly. 
              Please open it in a new window to view the network topology and management interface.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
