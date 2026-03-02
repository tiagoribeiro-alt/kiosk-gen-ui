import asyncio
import os
from google import genai
from google.genai import types

async def main():
    # 1. Test importing google.genai (done above)
    print("Successfully imported `google.genai`")
    
    # Needs API key or it fails instantiation, you can set GEMINI_API_KEY env var
    # Here we pass a dummy to just test syntax
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", "DUMMY_KEY"))
    
    # 2. Check classes mapped to client.aio.live
    print("\n--- Classes mapped to client.aio.live ---")
    print(f"Type: {client.aio.live.__class__.__name__}")
    print(f"Attributes/Methods: {dir(client.aio.live)}")
    
    # 3. Syntax to open a websocket for bidirectional audio
    print("\n--- Opening Websocket for bidirectional audio ---")
    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"] # Request audio responses back
    )
    
    try:
        # We don't actually run the context manager to avoid network fail on test env (unless valid key)
        # but this is the exact syntax:
        async with client.aio.live.connect(model="gemini-2.5-flash", config=config) as session:
            print("Connected to Gemini 2.5 Flash Live API!")
            
            # Send initial message (text or audio based on part)
            await session.send(types.LiveClientContent(
                turns=[
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text="Hello! Can you hear me?")]
                    )
                ],
                turn_complete=True
            ))

            # 4. Message Parsing Logic
            print("\n--- Awaiting Messages ---")
            async for message in session.receive():
                # Server sent content
                if message.server_content is not None:
                    model_turn = message.server_content.model_turn
                    if model_turn:
                        for part in model_turn.parts:
                            if part.text:
                                print(f"Model sent text: {part.text}")
                            elif part.inline_data:
                                print(f"Model sent audio data of length: {len(part.inline_data.data)}")
                                # Process audio chunk: part.inline_data.data
                            elif part.executable_code:
                                print("Model sent executable code")
                
                # Handled tools/function calls
                elif getattr(message, "tool_call", None) is not None:
                    print(f"Received tool call: {message.tool_call}")

                # Other things you can parse:
                # - message.setup_complete : bool
                # - message.turn_complete : bool (if server_content turn is done)
    
    except Exception as e:
        print(f"Error connecting (expected if key is dummy): {e}")

if __name__ == '__main__':
    asyncio.run(main())
