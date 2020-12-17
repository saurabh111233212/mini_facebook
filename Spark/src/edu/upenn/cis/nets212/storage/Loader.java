package edu.upenn.cis.nets212.storage;

import java.io.IOException;
import java.util.*;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStreamReader;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.api.java.function.Function;
import org.apache.spark.api.java.function.VoidFunction;
import org.apache.spark.sql.SparkSession;

import com.amazonaws.services.dynamodbv2.document.BatchWriteItemOutcome;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.ProvisionedThroughput;
import com.amazonaws.services.dynamodbv2.model.ResourceInUseException;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;
import com.amazonaws.thirdparty.jackson.databind.ObjectMapper;
import com.google.gson.Gson;

import edu.upenn.cis.nets212.config.Config;
import edu.upenn.cis.nets212.storage.SparkConnector;
import edu.upenn.cis.nets212.storage.DynamoConnector;
import edu.upenn.cis.nets212.storage.Article;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;



public class Loader {
	
	
	static Logger logger = LogManager.getLogger(Loader.class);

	/**
	 * Connection to DynamoDB
	 */
	DynamoDB db;
	Table articles;
	
	BufferedReader br;
	/**
	 * Path to json file
	 */
	final String path;
	
	SparkSession spark;
	
	JavaSparkContext context;
	
	/**
	 * Initialize with the default loader path
	 */
	public Loader() {
		this.path = "target/archive.txt";
		final File f = new File(path);
		try {
			br = new BufferedReader(new FileReader(path));
		} catch (FileNotFoundException e) {
			e.printStackTrace();
		}
		if (!f.exists())
			throw new RuntimeException("Can't load without the json file");
		System.setProperty("file.encoding", "UTF-8");
	}
	
	/**
	 * Initialize the database connection and open the file
	 * 
	 * @throws IOException
	 * @throws InterruptedException 
	 * @throws DynamoDbException 
	 */
	public void initialize() throws IOException, DynamoDbException, InterruptedException {
		logger.info("Connecting to DynamoDB...");
		db = DynamoConnector.getConnection("https://dynamodb.us-east-1.amazonaws.com");
		logger.debug("Connected!");
		
		logger.info("Connecting to Spark...");

		spark = SparkConnector.getSparkConnection();
		context = SparkConnector.getSparkContext();
		
		logger.debug("Connected!");
	}
	
	private void initializeTables() throws DynamoDbException, InterruptedException {
		try {
			articles = db.createTable("articles", Arrays.asList(new KeySchemaElement("id", KeyType.HASH)), // Partition
																												// key
					Arrays.asList(new AttributeDefinition("id", ScalarAttributeType.N)),
					new ProvisionedThroughput(100L, 100L));

			articles.waitForActive();
		} catch (final ResourceInUseException exists) {
			articles = db.getTable("articles");
		}
	}
	
	
	
	
	/*turns Article object into items ready for dynamo
	 * Ended up not being used as I couldn't figure out how to write to Dynamo using Spark
	 */
		static class Itemize implements Function<String[], Item> {

			@Override
			public Item call(String[] arr) throws Exception {
				String headline = arr[2];
				String category = arr[1];
				String link = arr[4];
				String date = arr[6];
				
				Item item = new Item()
						.withPrimaryKey("id", headline.hashCode())
						.withString("headline", headline)
						.withString("link", link)
						.withString("category", category.toLowerCase())
						.with("date", date);
				return item;
			}
			
		}
	
	/**
	 * Main functionality in the program: read and index articles,
	 * potentially erroring out
	 * 
	 * @throws IOException File read, network, and other errors
	 * @throws DynamoDbException DynamoDB is unhappy with something
	 * @throws InterruptedException User presses Ctrl-C
	 */
	public void run() throws IOException, DynamoDbException, InterruptedException {
		logger.info("Running");
		Gson gson = new Gson();
		List<Item> batch = new ArrayList<>(50);
		String line = br.readLine();
		while (line != null) {
			// parse JSON
			Article art = gson.fromJson(line, Article.class);
			String headline = art.headline;
			String link = art.link;
			String category = art.category;
			String date = art.date;
			Item item = new Item()
					.withPrimaryKey("id", headline.hashCode())
					.withString("headline", headline)
					.withString("link", link)
					.withString("category", category.toLowerCase())
					.with("date", date);
			batch.add(item);
			if (batch.size() > 23) {
				batchWrite(batch);
				batch = new ArrayList<>(50);
			}
			line = br.readLine();
		}
		
		if (batch.size() > 0) {
			batchWrite(batch);
		}
		logger.info("*** Finished reading Articles! ***");
	}
	
	// Batch writes to the data base, give a tablewrite items. 
		private void batchWrite(Collection<Item> itemsToWrite) {
			try {
				BatchWriteItemOutcome outcome =  db.batchWriteItem(new TableWriteItems("articles")
																	.withItemsToPut(itemsToWrite));
				do {
		            Map<String, List<com.amazonaws.services.dynamodbv2.model.WriteRequest>> unprocessedItems = outcome.getUnprocessedItems();
		
		            if (unprocessedItems.size() == 0) {
		                System.out.println("No unprocessed items found");
		            }
		            else {
		                System.out.println("Retrieving the unprocessed items");
		                outcome = db.batchWriteItemUnprocessed(unprocessedItems);
		            }
		
		        } while (outcome.getUnprocessedItems().size() > 0);
			} catch (Exception e) {
		        System.err.println("Failed to retrieve items: ");
		        e.printStackTrace(System.err);
		    }
		}
	
	
	/**
	 * Graceful shutdown
	 */
	public void shutdown() {
		logger.info("Shutting down");
		if (spark != null) {
			spark.close();
		}
		DynamoConnector.shutdown();
	}
	
	
	public static void main(final String[] args) {
		final Loader ld = new Loader();
		try {
			ld.initialize();
			ld.initializeTables();
			ld.run();
		} catch (final IOException ie) {
			logger.error("I/O error: ");
			ie.printStackTrace();
		} catch (final DynamoDbException e) {
			e.printStackTrace();
		} catch (final InterruptedException e) {
			e.printStackTrace();
		} finally {
//			InputStreamReader isr = new InputStreamReader(System.in);
//			BufferedReader br = new BufferedReader(isr); 
//			try {
//				String input = br.readLine();
//			} catch (IOException e) {
//				e.printStackTrace();
//			}
			ld.shutdown();
		}
	}
	
}
