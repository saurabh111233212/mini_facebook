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
import com.google.gson.Gson;

import edu.upenn.cis.nets212.config.Config;
import edu.upenn.cis.nets212.storage.DynamoConnector;
import edu.upenn.cis.nets212.hw1.Article;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;

import opennlp.tools.stemmer.Stemmer;
import opennlp.tools.stemmer.PorterStemmer;
import opennlp.tools.tokenize.SimpleTokenizer;

public class Loader2 {
	
	
	static Logger logger = LogManager.getLogger(Loader2.class);

	/**
	 * Connection to DynamoDB
	 */
	DynamoDB db;
	Table keywords;
	
	BufferedReader br;

	/**
	 * Path to json file
	 */
	final String path;
	
	
	/**
	 * Initialize with the default loader path
	 */
	public Loader2() {
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
	}
	
	private void initializeTables() throws DynamoDbException, InterruptedException {
		try {
			keywords = db.createTable("keywords", Arrays.asList(new KeySchemaElement("article_id", KeyType.HASH), //partition
																new KeySchemaElement("keyword", KeyType.RANGE)), //sort
																												
					Arrays.asList(new AttributeDefinition("article_id", ScalarAttributeType.N),
								  new AttributeDefinition("keyword", ScalarAttributeType.S)),
					new ProvisionedThroughput(100L, 100L));

			keywords.waitForActive();
		} catch (final ResourceInUseException exists) {
			keywords = db.getTable("keywords");
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
		Collection<Item> batch = new HashSet<>();
		String line = br.readLine();
		int i = 0;
		while (line != null) {
			// parse JSON
			Article art = gson.fromJson(line, Article.class);
			String headline = art.headline;
			String link = art.link;
			String[] words = headline.split(" ");
			Set<String> seen = new HashSet<>();
			for (String word : words) {
				if (seen.contains(word)) {
					continue;
				}
				Item item = new Item()
						.withPrimaryKey("article_id", i++)
						.withString("keyword", word.toLowerCase())
						.withString("headline", headline)
						.withString("link", link);
				batch.add(item);
				seen.add(word);
				if (batch.size() > 23) {
					batchWrite(batch);
					batch = new HashSet<>();
				}
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
				BatchWriteItemOutcome outcome =  db.batchWriteItem(new TableWriteItems("keywords")
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
		DynamoConnector.shutdown();
	}
	
	
	public static void main(final String[] args) {
		final Loader2 ld = new Loader2();
		try {
			ld.initialize();
			//ld.initializeTables();
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
