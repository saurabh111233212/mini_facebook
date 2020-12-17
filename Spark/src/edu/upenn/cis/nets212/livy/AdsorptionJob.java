package edu.upenn.cis.nets212.rec;

import java.io.IOException;
import java.util.*;

import org.apache.hadoop.dynamodb.DynamoDBItemWritable;
import org.apache.hadoop.dynamodb.read.DynamoDBInputFormat;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.mapred.JobConf;
import org.apache.hadoop.yarn.webapp.hamlet.HamletSpec.*;
import org.apache.livy.JobContext;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.api.java.function.Function2;
import org.apache.spark.api.java.function.PairFunction;
import org.apache.spark.sql.SparkSession;

import edu.upenn.cis.nets212.config.Config;
import edu.upenn.cis.nets212.hw3.livy.MyPair;
import edu.upenn.cis.nets212.storage.DynamoConnector;
import edu.upenn.cis.nets212.storage.SparkConnector;
import scala.Tuple2;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;

import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.ProvisionedThroughput;
import com.amazonaws.services.dynamodbv2.model.ResourceInUseException;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;
import com.fasterxml.jackson.databind.*;

public class AdsorptionJob {
	
	/**
	 * The basic logger
	 */
	static Logger logger = LogManager.getLogger(Adsorption.class);

	/**
	 * Connection to Apache Spark
	 */
	SparkSession spark;
	JavaSparkContext context;
	// connect to Dynamo
	DynamoDB db;
	
	Table articles;
	Table users;
	
	JobConf artJobConf;
	JobConf userJobConf;
	
	static int imax = 15;
	
	public Adsorption() {
		System.setProperty("file.encoding", "UTF-8");
	}
	
	/**
	 * Initialize the database connection and open the file
	 * 
	 * @throws IOException read File, network errors
	 * @throws InterruptedException user presses ctrl C
	 */
	public void initialize() throws IOException, InterruptedException {
		logger.info("Connecting to Spark...");

		spark = SparkConnector.getSparkConnection();
		
		context = SparkConnector.getSparkContext();
		logger.debug("Connected!");
		db = DynamoConnector.getConnection(Config.DYNAMODB_URL);
		initializeTables();
	}
	
	private static JobConf getDynamoDbJobConf(JavaSparkContext sc, String tableNameForRead, String tableNameForWrite) {
	    final JobConf jobConf = new JobConf(sc.hadoopConfiguration());
	    jobConf.set("dynamodb.servicename", "dynamodb");

	    jobConf.set("dynamodb.input.tableName", tableNameForRead);
	    jobConf.set("dynamodb.output.tableName", tableNameForWrite);

	    jobConf.set("dynamodb.awsAccessKeyId", Config.AWS_ACCESS);
	    jobConf.set("dynamodb.awsSecretAccessKey", Config.AWS_SECRET);
	    jobConf.set("dynamodb.awsSessionToken", Config.AWS_SESSION);
	    jobConf.set("dynamodb.endpoint", "dynamodb.us-east-1.amazonaws.com");
	    jobConf.set("dynamodb.regionid", "us-east-1");
	    jobConf.set("mapred.output.format.class", "org.apache.hadoop.dynamodb.write.DynamoDBOutputFormat");
	    jobConf.set("mapred.input.format.class", "org.apache.hadoop.dynamodb.read.DynamoDBInputFormat");

	    return jobConf;
	}
	
	/**
	 * Initlizes the tables 
	 * @throws DynamoDbException
	 * @throws InterruptedException
	 */
	private void initializeTables() throws DynamoDbException, InterruptedException {
		try {
			articles = db.createTable("articles", Arrays.asList(new KeySchemaElement("id", KeyType.HASH)), // Partition
																												// key
					Arrays.asList(new AttributeDefinition("id", ScalarAttributeType.N)),
					new ProvisionedThroughput(100L, 100L));
			
			users = db.createTable("articles", Arrays.asList(new KeySchemaElement("username", KeyType.HASH)), // Partition 
																											// key
					Arrays.asList(new AttributeDefinition("username", ScalarAttributeType.S)),
					new ProvisionedThroughput(100L, 100L));

			articles.waitForActive();
			users.waitForActive();
			artJobConf = getDynamoDbJobConf(context, "articles", "articles");
			userJobConf = getDynamoDbJobConf(context, "users", "users");
		} catch (final ResourceInUseException exists) {
			articles = db.getTable("articles");
			users = db.getTable("users");
			artJobConf = getDynamoDbJobConf(context, "articles", "articles");
			userJobConf = getDynamoDbJobConf(context, "users", "users");
		}
	}
		
	
	/**
	 * Helper function: swap key and value in a JavaPairRDD
	 * 
	 * @author zives
	 *
	 */
	static class SwapKeyValue<T1,T2> implements PairFunction<Tuple2<T1,T2>, T2,T1> {
		/**
		 * 
		 */
		private static final long serialVersionUID = 1L;

		@Override
		public Tuple2<T2, T1> call(Tuple2<T1, T2> t) throws Exception {
			return new Tuple2<>(t._2, t._1);
		}
		
	}
	// assigns all Users to have User label 1
	static class AssignLabels<T1, T2> implements PairFunction<Tuple2<Object, Tuple2<Object, Double>>, Object, Map<User, Double>> {
		@Override 
		public Tuple2<Object, Map<User, Double>> call(Tuple2<Object, Tuple2<Object, Double>> t) {
			Map<User, Double> labels = new HashMap<>();
			if (t._1.getClass() == User.class) {
				labels.put((User) t._1, 1.0);
			}
			return new Tuple2<Object, Map<User, Double>>(t._1, labels);
		}
	}
	
	//sends out my labels to all my neighbors, weighted by the weigh on the edge
	static class PropLabels<T1, T2> implements 
	PairFunction<Tuple2<Object, Tuple2<Tuple2<Object, Double>, Map<User, Double>>>, Object, Map<User, Double>> {

		@Override
		public Tuple2<Object, Map<User, Double>> call(Tuple2<Object, Tuple2<Tuple2<Object, Double>, Map<User, Double>>> t) throws Exception {
			Map<User, Double> labels = t._2._2;
			Object dest = t._2._1._1;
			double weight = t._2._1._2;
			Map<User, Double> res = new HashMap<>();
			for (User l : labels.keySet()) {
				res.put(l, (labels.get(l) * weight) / labels.size());
			}
			return new Tuple2<Object, Map<User, Double>>(dest, res);
		}
		
	}
	
	//Collects all the labels of the same user
	static class ReduceLabels<T1, T2> implements Function2<Map<User, Double>, Map<User, Double>, Map<User, Double>> {

		@Override
		public Map<User, Double> call(Map<User, Double> v1, Map<User, Double> v2) throws Exception {
			Map<User, Double> res = v1;
			for (User u : v2.keySet()) {
				res.put(u, v1.getOrDefault(u, 0.0) + v2.get(u));
			}
			return res;
		}
		
	}
	
	//Normalizes labels. Sets user to 1 if the node is a user (to avoid washout)
	static class NormLabels<T1, T2> implements PairFunction<Tuple2<Object, Map<User, Double>>, Object, Map<User, Double>> {

		@Override
		public Tuple2<Object, Map<User, Double>> call(Tuple2<Object, Map<User, Double>> t) throws Exception {
			Map<User, Double> res = new HashMap<>();
			if (t._1.getClass() == User.class) {
				res.put((User)t._1, 1.0);
				return new Tuple2<Object, Map<User, Double>>(t._1, res);
			}
			Map<User, Double> labels = t._2;
			double sum = 0;
			for (double v : labels.values()) {
				sum += v;
			}
			for (User u : labels.keySet()) {
				res.put(u, labels.get(u) / sum);
			}
			return new Tuple2<Object, Map<User, Double>>(t._1, res);
		}
		
	}
	
	
	/**
	 * Main functionality: run the adsorption algo. 
	 * 
	 * @throws IOException read File, network errors
	 * @throws InterruptedException user presses ctrl C
	 */
	public void run() throws IOException, InterruptedException {
		JavaPairRDD<Text, DynamoDBItemWritable> articles = context.hadoopRDD(artJobConf, DynamoDBInputFormat.class, 
				Text.class, DynamoDBItemWritable.class);
		System.out.println("Num articles: " + articles.count());
		JavaPairRDD<Text, DynamoDBItemWritable> users = context.hadoopRDD(userJobConf, DynamoDBInputFormat.class, 
				Text.class, DynamoDBItemWritable.class);
		System.out.println("Num users: " + users.count()); 
		JavaPairRDD<Object, Object> caEdges = articles.mapToPair(t -> {
			Map<String, AttributeValue> attrs = t._2.getItem();
			return new Tuple2<Object, Object>(attrs.get("category").getS(), 
											  Integer.parseInt(attrs.get("id").getN()));
		});
		JavaPairRDD<Object, Object> acEdges = caEdges.mapToPair(new SwapKeyValue<>());
		JavaPairRDD<Object, Object> uuEdges = users.mapToPair(t -> {
			Map<String, AttributeValue> attrs = t._2.getItem();
			return new Tuple2<String, List<String>>(attrs.get("username").getS(), 
											  attrs.get("friends").getSS());
			}).flatMapToPair(t -> {
				String user = t._1;
				List<String> friends = t._2;
				List<Tuple2<Object, Object>> pairs = new ArrayList<>();
				for (String f : friends) {
					pairs.add(new Tuple2<>(new User(user), new User(f)));
				}
				return pairs.iterator();
			});		
		
		JavaPairRDD<Object, Object> ucEdges = users.mapToPair(t -> {
			Map<String, AttributeValue> attrs = t._2.getItem();
			return new Tuple2<User, List<String>>(new User(attrs.get("username").getS()), 
					attrs.get("interests").getSS());
		}).flatMapToPair(t -> {
			List<String> interests = t._2;
			List<Tuple2<Object, Object>> pairs = new ArrayList<>();
			for (String c : interests) {
				pairs.add(new Tuple2<>(t._1, c));
			}
			return pairs.iterator();
		});
		JavaPairRDD<Object, Object> cuEdges = ucEdges.mapToPair(new SwapKeyValue<>());
		
		//at this point edges should be properly normalized and ready to go
		JavaPairRDD<Object, Tuple2<Object, Double>> edges = 
				caEdges.union(acEdges).union(uuEdges).union(ucEdges).union(cuEdges)
				.mapToPair(t -> {
					return new Tuple2<Object, Tuple2<Object, Double>>(t._1, new Tuple2<>(t._2, 1.0));
				});
		JavaPairRDD<Object, Map<User, Double>> labels;
		labels = edges.reduceByKey((a, b) -> b)
				.mapToPair(new AssignLabels<Object, Map<User, Double>>());
		JavaPairRDD<Object, Map<User, Double>> nextLabels;
		JavaPairRDD<Object, Map<User, Double>> normNextLabels;
		
		for (int i = 0; i < imax; i++) {
			nextLabels = edges.join(labels).mapToPair(new PropLabels<>()).reduceByKey(new ReduceLabels<>());
			normNextLabels = nextLabels.mapToPair(new NormLabels<>());
			labels = normNextLabels;
		}
		// at this point labels will be the RDD which maps every node to a Map of Labels after adsoprtion
		System.out.println(labels.count());
		System.out.println("adsorption run");
		
	}
	
	
	
	
	/**
	 * Graceful shutdown
	 */
	public void shutdown() {
		logger.info("Shutting down");

		if (spark != null)
			spark.close();
	}
	
	
	
	@Override
	public void call(JobContext arg0) throws Exception {
		initialize();
		run();
	}
	
	
	/**
	 * class representing an Article, User, Label
	 * @author nets212
	 *
	 */
	
	static public class User {
		public String username;
		public User(String name) {
			username = name;
		}
		public boolean equals(Object other) {
			if  (other.getClass() != this.getClass()) {
				return false;
			}
			return this.username.equals(((User) other).username);
		}
	}
	
}