package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"golang.org/x/crypto/bcrypt"
	"github.com/joho/godotenv"
)

type Poll struct {
	ID       bson.ObjectID `bson:"_id,omitempty" json:"id"`
	Question string        `bson:"question" json:"question"`
	Options  []string      `bson:"options" json:"options"`
}
type CreatePollRequest struct {
	Question string   `json:"question"`
	Options  []string `json:"options"`
}
type VoteRequest struct {
	Option  string `json:"option"`
	VoterID string `json:"voterId"`
}
type Vote struct {
	ID      bson.ObjectID `bson:"_id,omitempty"`
	PollID  bson.ObjectID `bson:"pollId"`
	VoterID string        `bson:"voterId"`
	Option  string        `bson:"option"`
}
type User struct {
	ID           bson.ObjectID `bson:"_id,omitempty" json:"id"`
	Username     string        `bson:"username" json:"username"`
	PasswordHash string        `bson:"passwordHash" json:"-"`
}
type RegisterRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

var jwtSecret = []byte("hcl-guvi-secret-key")

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")

		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authorization token required",
			})
			c.Abort()
			return
		}

		if len(authHeader) < 7 || authHeader[:7] != "Bearer " {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid authorization format",
			})
			c.Abort()
			return
		}

		tokenString := authHeader[7:]

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid or expired token",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func main() {
	err := godotenv.Load()
if err != nil {
    log.Fatal("Error loading .env file")
}

mongoURI := os.Getenv("MONGODB_URI")

	// MongoDB connection

	mongoClient, err := mongo.Connect(
    	options.Client().ApplyURI(mongoURI),
	)
	if err != nil {
		panic(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err = mongoClient.Ping(ctx, nil)
	if err != nil {
		panic(err)
	}

	fmt.Println("MongoDB connected successfully!")
	votesCollection := mongoClient.Database("poll_app").Collection("votes")

	_, err = votesCollection.Indexes().CreateOne(
		context.Background(),
		mongo.IndexModel{
			Keys: bson.D{
				{Key: "pollId", Value: 1},
				{Key: "voterId", Value: 1},
			},
			Options: options.Index().SetUnique(true),
		},
	)

	if err != nil {
		log.Fatal("Failed to create vote index:", err)
	}

	// Redis connection
	redisClient := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})

	err = redisClient.Ping(context.Background()).Err()
	if err != nil {
		panic(err)
	}

	fmt.Println("Redis connected successfully!")

	// Gin server
	r := gin.Default()
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})
	r.POST("/register", func(c *gin.Context) {
		var req RegisterRequest

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "Invalid request"})
			return
		}

		passwordHash, err := bcrypt.GenerateFromPassword(
			[]byte(req.Password),
			bcrypt.DefaultCost,
		)

		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to secure password"})
			return
		}

		user := User{
			ID:           bson.NewObjectID(),
			Username:     req.Username,
			PasswordHash: string(passwordHash),
		}

		collection := mongoClient.Database("poll_app").Collection("users")
		var existingUser User

		err = collection.FindOne(
			context.Background(),
			bson.M{"username": req.Username},
		).Decode(&existingUser)

		if err == nil {
			c.JSON(409, gin.H{"error": "Username already exists"})
			return
		}

		_, err = collection.InsertOne(context.Background(), user)

		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to create user"})
			return
		}

		c.JSON(201, gin.H{
			"message":  "User registered successfully",
			"username": user.Username,
		})
	})
	r.POST("/login", func(c *gin.Context) {
		var req LoginRequest

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "Invalid request"})
			return
		}

		collection := mongoClient.Database("poll_app").Collection("users")

		var user User
		fmt.Println("Searching for user:", req.Username)

		err := collection.FindOne(
			context.Background(),
			bson.M{"username": req.Username},
		).Decode(&user)

		if err != nil {
			c.JSON(401, gin.H{"error": "Invalid username or password"})
			return
		}

		err = bcrypt.CompareHashAndPassword(
			[]byte(user.PasswordHash),
			[]byte(req.Password),
		)

		if err != nil {
			c.JSON(401, gin.H{"error": "Invalid username or password"})
			return
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"username": user.Username,
			"exp":      time.Now().Add(24 * time.Hour).Unix(),
		})

		tokenString, err := token.SignedString(jwtSecret)

		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to create token"})
			return
		}

		c.JSON(200, gin.H{
			"message": "Login successful",
			"token":   tokenString,
		})
	})
	r.POST("/polls", authMiddleware(), func(c *gin.Context) {
		var req CreatePollRequest

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "Invalid request"})
			return
		}

		if req.Question == "" || len(req.Options) < 2 {
			c.JSON(400, gin.H{"error": "Question and at least 2 options are required"})
			return
		}

		seenOptions := make(map[string]bool)

		for _, option := range req.Options {
			option = strings.TrimSpace(option)

			if option == "" {
				c.JSON(400, gin.H{"error": "Options cannot be empty"})
				return
			}

			optionKey := strings.ToLower(option)

			if seenOptions[optionKey] {
				c.JSON(400, gin.H{"error": "Options must be different"})
				return
			}

			seenOptions[optionKey] = true
		}

		poll := Poll{
			ID:       bson.NewObjectID(),
			Question: req.Question,
			Options:  req.Options,
		}

		collection := mongoClient.Database("poll_app").Collection("polls")

		_, err := collection.InsertOne(context.Background(), poll)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to create poll"})
			return
		}

		c.JSON(201, poll)
	})
	r.GET("/polls/:id", func(c *gin.Context) {
		id := c.Param("id")

		objectID, err := bson.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(400, gin.H{"error": "Invalid poll ID"})
			return
		}

		collection := mongoClient.Database("poll_app").Collection("polls")

		var poll Poll

		err = collection.FindOne(
			context.Background(),
			bson.M{"_id": objectID},
		).Decode(&poll)

		if err != nil {
			c.JSON(404, gin.H{"error": "Poll not found"})
			return
		}

		c.JSON(200, poll)
	})
	r.POST("/polls/:id/vote", func(c *gin.Context) {
		id := c.Param("id")

		objectID, err := bson.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(400, gin.H{"error": "Invalid poll ID"})
			return
		}

		var req VoteRequest

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "Invalid request"})
			return
		}
		if req.VoterID == "" {
			c.JSON(400, gin.H{"error": "Voter ID is required"})
			return
		}

		collection := mongoClient.Database("poll_app").Collection("polls")

		var poll Poll

		err = collection.FindOne(
			context.Background(),
			bson.M{"_id": objectID},
		).Decode(&poll)

		if err != nil {
			c.JSON(404, gin.H{"error": "Poll not found"})
			return
		}

		validOption := false

		for _, option := range poll.Options {
			if option == req.Option {
				validOption = true
				break
			}
		}

		if !validOption {
			c.JSON(400, gin.H{"error": "Invalid option"})
			return
		}
		votesCollection := mongoClient.Database("poll_app").Collection("votes")

		vote := Vote{
			ID:      bson.NewObjectID(),
			PollID:  objectID,
			VoterID: req.VoterID,
			Option:  req.Option,
		}

		_, err = votesCollection.InsertOne(
			context.Background(),
			vote,
		)

		if err != nil {
			if mongo.IsDuplicateKeyError(err) {
				c.JSON(409, gin.H{
					"error": "You have already voted in this poll",
				})
				return
			}

			c.JSON(500, gin.H{
				"error": "Failed to save vote",
			})
			return
		}

		voteKey := "poll:" + id + ":votes"

		err = redisClient.HIncrBy(
			context.Background(),
			voteKey,
			req.Option,
			1,
		).Err()

		if err != nil {
			c.JSON(500, gin.H{
				"error": "Failed to update vote count",
			})
			return
		}

		redisClient.Publish(
			context.Background(),
			"poll:"+id+":updates",
			req.Option,
		)

		c.JSON(200, gin.H{
			"message": "Vote recorded successfully",
			"option":  req.Option,
		})
	})
	r.GET("/polls/:id/results", func(c *gin.Context) {
		id := c.Param("id")

		_, err := bson.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(400, gin.H{"error": "Invalid poll ID"})
			return
		}

		voteKey := "poll:" + id + ":votes"

		votes, err := redisClient.HGetAll(
			context.Background(),
			voteKey,
		).Result()

		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to get results"})
			return
		}

		c.JSON(200, gin.H{
			"pollId": id,
			"votes":  votes,
		})
	})
	r.GET("/polls/:id/ws", func(c *gin.Context) {
		id := c.Param("id")

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		pubsub := redisClient.Subscribe(
			context.Background(),
			"poll:"+id+":updates",
		)
		defer pubsub.Close()

		for {
			msg, err := pubsub.ReceiveMessage(context.Background())
			if err != nil {
				return
			}

			err = conn.WriteMessage(
				websocket.TextMessage,
				[]byte(msg.Payload),
			)
			if err != nil {
				return
			}
		}
	})
	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "HCL GUVI Poll Backend is running!",
		})
	})

	r.Run(":8080")
}
