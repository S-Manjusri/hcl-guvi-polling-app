import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";

function App() {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [poll, setPoll] = useState(null);
  const [results, setResults] = useState({});
  const totalVotes = Object.values(results).reduce(
  (sum, count) => sum + Number(count),
  0
);
  const [showResults, setShowResults] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const voterId = username.trim().toLowerCase() || crypto.randomUUID();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  useEffect(() => {
  const pollIdFromUrl = window.location.pathname.split("/poll/")[1];
  const pollId = pollIdFromUrl || "6aacc33bfd840fa5934ae3b3";

  fetch(`https://hcl-guvi-polling-app.onrender.com/polls/${pollId}`)
    .then((response) => response.json())
    .then((data) => {
      setPoll(data);
    })
    .catch((error) => {
      console.error(error);
    });
}, []);
  useEffect(() => {
     if (!poll || !isLoggedIn) return;

    const socket = new WebSocket(
      `wss://hcl-guvi-polling-app.onrender.com/polls/${poll.id}/ws`
    );

    socket.onmessage = async () => {
  const response = await fetch(
    `https://hcl-guvi-polling-app.onrender.com/polls/${poll.id}/results`
  );

  const data = await response.json();

  setResults(data.votes);
  setShowResults(true);
};

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      socket.close();
    };
  }, [poll]);
const loginUser = async () => {
  if (!username.trim() || !password.trim()) {
    alert("Please enter username and password");
    return;
  }

  try {
    const response = await fetch("https://hcl-guvi-polling-app.onrender.com/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Login failed");
      return;
    }

    localStorage.setItem("token", data.token);
    setIsLoggedIn(true);

    alert("Login successful!");
  } catch (error) {
    console.error(error);
    alert("Could not connect to backend");
  }
};

const logoutUser = () => {
  localStorage.removeItem("token");
  setUsername("");
  setPassword("");
  setIsLoggedIn(false);
  alert("Logged out successfully!");
};
const registerUser = async () => {
  if (!username.trim() || !password.trim()) {
    alert("Please enter username and password");
    return;
  }

  try {
    const response = await fetch("https://hcl-guvi-polling-app.onrender.com/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Registration failed");
      return;
    }

    alert("Registration successful! Please login.");
    setShowRegister(false);
  } catch (error) {
    console.error(error);
    alert("Could not connect to backend");
  }
};

  const handleOptionChange = (index, value) => {
    const updatedOptions = [...options];
    updatedOptions[index] = value;
    setOptions(updatedOptions);
  };

  const addOption = () => {
    setOptions([...options, ""]);
  };

  const createPoll = async () => {
    if (
      !question.trim() ||
      options.length < 2 ||
      options.some((option) => !option.trim())
    ) {
      alert("Please enter a question and at least 2 options");
      return;
    }
    const uniqueOptions = new Set(
  options.map((option) => option.trim().toLowerCase())
);

if (uniqueOptions.size !== options.length) {
  alert("Options must be different");
  return;
}

    try {
      const token = localStorage.getItem("token");

if (!token) {
  alert("Please login first");
  return;
}

const response = await fetch("https://hcl-guvi-polling-app.onrender.com/polls", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    question,
    options,
  }),
});

      if (!response.ok) {
        throw new Error("Failed to create poll");
      }

      const data = await response.json();
      console.log("CREATE POLL RESPONSE:", data);
      setPoll(data);
      alert("Poll created successfully!");
    } catch (error) {
      console.error(error);
      alert("Could not connect to backend");
    }
  };
  
  const isSharedPoll = window.location.pathname.startsWith("/poll/");

  return (
   <div
      style={{
        maxWidth: "760px",
        margin: "0 auto",
        
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        boxSizing: "border-box",
        backgroundColor: "#0f172a",
      }}
    >
      {!isSharedPoll && !isLoggedIn && !showRegister && (
    <div
      style={{
        width: "100%",
        maxWidth: "420px",
        height: "334px",
        margin: "30px auto",
        padding: "24px",
        border: "1px solid #334155",
        borderRadius: "16px",
        backgroundColor: "#1e293b",
        boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        boxSizing: "border-box",
      }}
    >
  <h2
    style={{
      marginTop: "0",
      marginBottom: "18px",
      color: "white",
      fontSize: "22px",
    }}
  >
    Login
  </h2>

  <input
    type="text"
    placeholder="Username"
    value={username}
    onChange={(e) => setUsername(e.target.value)}
    style={{
      width: "100%",
      padding: "12px",
      marginBottom: "10px",
      boxSizing: "border-box",
      backgroundColor: "#0f172a",
      color: "white",
      border: "1px solid #475569",
      borderRadius: "8px",
    }}
  />


<div style={{ position: "relative", width: "100%", marginBottom: "18px" }}>
  <input
    type={showPassword ? "text" : "password"}
    placeholder="Password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    style={{
      width: "100%",
      padding: "12px 45px 12px 12px",
      boxSizing: "border-box",
      backgroundColor: "#0f172a",
      color: "white",
      border: "1px solid #475569",
      borderRadius: "8px",
    }}
  />

  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    style={{
      position: "absolute",
      top: "50%",
      transform: "translateY(-50%)",
      right: "10px",
      background: "none",
      border: "none",
      color: "#94a3b8",
      cursor: "pointer",
      fontSize: "18px",
      padding: "5px",
    }}
  >
    {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
  </button>
</div>



  <button
  onClick={loginUser}
  style={{
    width: "100%",
    padding: "12px",
    marginRight: "0",
    backgroundColor: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  }}
>
  Login
</button>
<button
  onClick={() => setShowRegister(true)}
  style={{
    width: "100%",
    marginTop: "12px",
    padding: "11px",
    backgroundColor: "transparent",
    color: "#a78bfa",
    border: "1px solid #7c3aed",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "600",
  }}
>
  Create an Account
</button>
<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: "10px",
    margin: "16px 0",
    color: "#64748b",
    fontSize: "13px",
  }}
>
  <div style={{ flex: 1, height: "1px", backgroundColor: "#334155" }} />
  <span>or</span>
  <div style={{ flex: 1, height: "1px", backgroundColor: "#334155" }} />
</div>
</div>
)}
 

{showRegister && (
  <div
    style={{
  width: "100%",
  maxWidth: "420px",
  height: "334px",
  margin: "30px auto",
  padding: "24px",
  border: "1px solid #334155",
  borderRadius: "16px",
  backgroundColor: "#1e293b",
  boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
  boxSizing: "border-box",
}}
  >
    <h2
      style={{
        marginTop: "0",
        marginBottom: "18px",
        color: "white",
        fontSize: "22px",
      }}
    >
      Create Your Account
    </h2>

    <input
      type="text"
      placeholder="Username"
      value={username}
      onChange={(e) => setUsername(e.target.value)}
      style={{
        width: "100%",
        padding: "12px",
        marginBottom: "10px",
        boxSizing: "border-box",
      }}
    />

   <div style={{ position: "relative", marginBottom: "10px" }}>
  <input
    type={showPassword ? "text" : "password"}
    placeholder="Password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    style={{
      width: "100%",
      padding: "12px",
      paddingRight: "45px",
      boxSizing: "border-box",
    }}
  />

  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    style={{
      position: "absolute",
      right: "10px",
      top: "50%",
      transform: "translateY(-50%)",
      background: "none",
      border: "none",
      color: "#64748b",
      cursor: "pointer",
    }}
  >
    {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
  </button>
</div>

    <button
      onClick={registerUser}
      style={{
        width: "100%",
        padding: "12px",
        backgroundColor: "#7c3aed",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",

      }}
    >
      Register
    </button>

 <button
  onClick={() => setShowRegister(false)}
  style={{
    width: "100%",
    marginTop: "10px",
    padding: "11px",
    backgroundColor: "transparent",
    color: "#a78bfa",
    border: "1px solid #7c3aed",
    borderRadius: "8px",
    cursor: "pointer",
  }}
>
  Back to Login
</button>
  </div>
)}
      {!isSharedPoll && isLoggedIn && (
  <div>
    <h1 style={{ textAlign: "center", marginBottom: "30px" }}>
      Live Polling Tool
    </h1>
    {isLoggedIn && (
  <button
    onClick={logoutUser}
    style={{
      padding: "10px 20px",
      backgroundColor: "#dc2626",
      color: "white",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      margin: "0 auto 20px",
      display: "block",
    }}
  >
    Logout
  </button>
)}

    <div
      style={{
        marginTop: "20px",
        padding: "20px",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        backgroundColor: "#f9fafb",
      }}
    >
      <h2>Create a Poll</h2>

      <input
        type="text"
        placeholder="Enter your question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        style={{
          width: "100%",
          padding: "12px",
          marginBottom: "15px",
          boxSizing: "border-box",
        }}
      />

      {options.map((option, index) => (
        <input
          key={index}
          type="text"
          placeholder={`Option ${index + 1}`}
          value={option}
          onChange={(e) => handleOptionChange(index, e.target.value)}
          style={{
            width: "100%",
            padding: "12px",
            marginBottom: "10px",
            boxSizing: "border-box",
          }}
        />
      ))}

      <button
        onClick={addOption}
        disabled={options.length >= 4}
        style={{
          padding: "10px 18px",
          backgroundColor: options.length >= 4 ? "#d1d5db" : "#f3f4f6",
          color: options.length >= 4 ? "#6b7280" : "#111827",
          border: "1px solid #d1d5db",
          borderRadius: "6px",
          cursor: options.length >= 4 ? "not-allowed" : "pointer",
          fontSize: "14px",
        }}
      >
        {options.length >= 4 ? "Maximum 4 Options" : "+ Add Option"}
      </button>

      <br />
      <br />

      <button
  onClick={createPoll}
  style={{
    padding: "12px 24px",
    backgroundColor: "#16a34a",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "bold",
  }}
>
  Create Poll
</button>
    </div>
    </div>
    )}
      {poll && (isLoggedIn || isSharedPoll) && (
        <div
          style={{
            marginTop: "30px",
            padding: "30px",
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "16px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            color: "white",
          }}
        >
        <div
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "7px 14px",
    backgroundColor: "#16a34a",
    color: "white",
    borderRadius: "20px",
    fontSize: "14px",
    fontWeight: "700",
    marginBottom: "18px",
  }}
>
  <span
    style={{
      width: "9px",
      height: "9px",
      backgroundColor: "#bbf7d0",
      borderRadius: "50%",
      display: "inline-block",
    }}
  ></span>
  LIVE POLL
</div>
          <h2
            style={{
              marginBottom: "20px",
              color: "white",
              fontSize: "22px",
            }}
          >
            {poll.question}
          </h2>
        

          {(poll?.options || []).map((option, index) => (
            <button
  key={index}
  onClick={async () => {
    try {
      const response = await fetch(
        `https://hcl-guvi-polling-app.onrender.com/polls/${poll.id}/vote`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            option: option,
            voterId: voterId,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Vote failed");
      }

      alert("Vote submitted successfully!");
      const resultResponse = await fetch(
        `https://hcl-guvi-polling-app.onrender.com/polls/${poll.id}/results`
    );

    const resultData = await resultResponse.json();

    setResults(resultData.votes);
    setShowResults(true);
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }}
  style={{
  width: "100%",
  padding: "14px 18px",
  marginBottom: "12px",
  backgroundColor: "#334155",
  color: "white",
  border: "1px solid #475569",
  borderRadius: "10px",
  cursor: "pointer",
  fontSize: "16px",
  textAlign: "left",
}}
>
  {option}
</button>
          ))}
            {showResults && (
  <div
    style={{
      marginTop: "25px",
      padding: "20px",
      border: "1px solid #e5e7eb",
      borderRadius: "8px",
      backgroundColor: "#f9fafb",
    }}
  >
   <h3
  style={{
    marginTop: "0",
    color: "#1e293b",
    marginBottom: "18px",
    fontSize: "20px",
  }}
>
  Live Results
</h3>
<div
  style={{
    marginTop: "15px",
    marginBottom: "15px",
    padding: "10px 14px",
    backgroundColor: "#293452",
    borderRadius: "8px",
    color: "#f3f5f7",
    fontSize: "14px",
    display: "inline-block",
  }}
>
  Total votes:{" "}
  <strong style={{ color: "#fefbfb" }}>{totalVotes}</strong>
</div>

    {(poll?.options || []).map((option, index) => (
      <div
        key={option}
        style={{
          marginTop: "12px",
          padding: "16px 18px",
          backgroundColor: "#1e293b",
          borderRadius: "10px",
          border: "1px solid #475569",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
  style={{
    color: "#f8fafc",
    fontSize: "16px",
    fontWeight: "500",
  }}
>
  {option}
</span>
<div
  style={{
    width: "70%",
    height: "8px",
    backgroundColor: "#334155",
    borderRadius: "10px",
    marginTop: "8px",
  }}
>
  <div
    style={{
      width: totalVotes > 0
        ? `${((results[option] || 0) / totalVotes) * 100}%`
        : "0%",
      height: "100%",
      backgroundColor: "#22c55e",
      borderRadius: "10px",
    }}
  ></div>
</div>
<strong
  style={{
    color: "#60a5fa",
    fontSize: "15px",
  }}
>
  {results[option] || 0} votes
</strong>
      </div>
    ))}
  </div>
)}

          {isLoggedIn && (
          <div
  style={{ 
    marginTop: "20px", 
    padding: "18px", 
    backgroundColor: "#1e293b", 
    borderRadius: "10px", 
    border: "1px solid #475569",
  }} 
>
  <strong style={{ color: "white", fontSize: "16px" }}>
    Share this poll:
  </strong> 

  <br />

  <a
    href={`${window.location.origin}/poll/${poll.id}`}
    target="_blank"
    rel="noopener noreferrer"
    style={{
      display: "inline-block",
      marginTop: "10px",
      padding: "10px",
      backgroundColor: "#0f172a",
      borderRadius: "6px",
      color: "#60a5fa",
      wordBreak: "break-all",
      textDecoration: "none",
    }}
  >
    {window.location.origin}/poll/{poll.id}
  </a>
  <button
  onClick={() => {
    navigator.clipboard.writeText(
      `${window.location.origin}/poll/${poll.id}`
    );
    alert("Poll link copied!");
  }}
  style={{
    marginTop: "10px",
    padding: "10px 18px",
    backgroundColor: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
  }}
>
  Copy Poll Link
</button>
</div>
)}
        </div>
      )}
    </div>
  );
}

export default App;